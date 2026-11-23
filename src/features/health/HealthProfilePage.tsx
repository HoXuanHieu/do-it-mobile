import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg'
import { locale, t, tx, type Key } from '../../i18n'
import { DAY_MS, formatDate, parseDateKey, startOfDay, toDateKey } from '../../lib/dates'
import { applyServerErrors } from '../../lib/forms'
import {
  Button, Card, ConfirmDialog, DateInput, ErrorText, Field, H2, IconButton, Input, Loading, Muted, Row, RowBetween, Screen, Segmented, Txt,
} from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { HealthProfileDto, MeasurementDto } from './api'
import { Disclaimer } from './HealthPage'
import { NutritionTab } from './NutritionTab'
import { BmiPill, Chip, Macro, MacroRow, Tag, UNDERWEIGHT } from './parts'
import { ProfileFormDialog } from './ProfileFormDialog'
import {
  ACTIVITY, CONDITIONS, GOALS, labelOf, num, parseNum, SEXES,
  useAddMeasurement, useDeleteProfile, useHealthProfiles, useMeasurements, useRemoveMeasurement, useUpdateProfile, withCheckIn,
} from './queries'
import { WorkoutTab } from './WorkoutTab'
import { bodyStats, FAT_LEVEL_LABEL } from './catalog'

type Tab = 'overview' | 'nutrition' | 'workouts' | 'progress'
const TABS: { value: Tab; label: Key }[] = [
  { value: 'overview', label: 'Đánh giá' },
  { value: 'nutrition', label: 'Chế độ ăn' },
  { value: 'workouts', label: 'Tập luyện' },
  { value: 'progress', label: 'Theo dõi chỉ số' },
]

/** Whole days since the latest measurement; null when there is none. */
function daysSinceMeasured(p: HealthProfileDto) {
  const last = parseDateKey(p.latestMeasurement?.date)
  return last ? Math.round((startOfDay(new Date()).getTime() - last.getTime()) / DAY_MS) : null
}

/** Days since the latest measurement ≥ the check-in interval (same anchor as the server reminder). */
function checkInDue(p: HealthProfileDto) {
  const days = daysSinceMeasured(p)
  return !!p.checkInEveryDays && days != null && days >= p.checkInEveryDays
}

/** /health/[id]?tab=overview|nutrition|workouts|progress */
export function HealthProfilePage() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>()
  const { data: profiles, isPending, isError } = useHealthProfiles()
  const remove = useDeleteProfile()
  const c = useColors()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const tab: Tab = TABS.find((x) => x.value === params.tab)?.value ?? 'overview'
  const setTab = (v: Tab) => router.setParams({ tab: v })

  if (isPending) return <Screen><Loading /></Screen>
  if (isError) return <Screen><ErrorText>{t('Không tải được hồ sơ sức khỏe.')}</ErrorText></Screen>
  const p = profiles.find((x) => x.id === params.id)
  if (!p) return <Screen><Muted>{t('Không tìm thấy hồ sơ này.')}</Muted></Screen>

  const goal = GOALS.find((g) => g.value === p.goal)!
  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <Muted>
        {t(labelOf(SEXES, p.sex))} · {t('{age} tuổi', { age: p.assessment.age })} · {num(p.heightCm)} cm · {num(p.weightKg)} kg ·{' '}
        {goal.icon} {t(goal.label)} · {t(labelOf(ACTIVITY, p.activityLevel))}
      </Muted>
      <Row>
        <Button small variant="outline" title={t('Sửa hồ sơ')} onPress={() => setEditing(true)} />
        <Button small variant="danger" title={t('Xóa')} onPress={() => setConfirm(true)} />
      </Row>

      {checkInDue(p) && tab !== 'progress' && (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, borderLeftWidth: 4, borderColor: c.warn, backgroundColor: c.warn + '1f' }}>
          <Txt style={{ flex: 1 }}>🔔 {t('Đã đến lúc đánh giá lại chỉ số cơ thể.')}</Txt>
          <Button small title={t('Cập nhật ngay')} onPress={() => setTab('progress')} />
        </View>
      )}

      <Segmented value={tab} onChange={setTab} options={TABS.map((x) => ({ value: x.value, label: t(x.label) }))} />

      {tab === 'overview' && <OverviewTab p={p} />}
      {tab === 'nutrition' && <NutritionTab p={p} />}
      {tab === 'workouts' && <WorkoutTab p={p} />}
      {tab === 'progress' && <ProgressTab p={p} />}

      <Disclaimer />
      <ProfileFormDialog open={editing} profile={p} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirm}
        title={t('Xóa hồ sơ sức khỏe?')}
        message={t('Hồ sơ “{name}” cùng nhật ký ăn uống, lịch tập và chỉ số sẽ bị xóa.', { name: p.name })}
        busy={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          remove.mutate(p.id, {
            onSuccess: () => {
              setConfirm(false)
              if (router.canGoBack()) router.back()
              else router.replace('/health')
            },
          })
        }
      />
    </Screen>
  )
}

// ---------- overview ----------

type Tone = 'ok' | 'warn' | 'info'

/** Plain-language advice from the assessment and body conditions. */
function advice(p: HealthProfileDto): { tone: Tone; text: string }[] {
  const a = p.assessment
  const out: { tone: Tone; text: string }[] = []
  const bmiText: Record<string, Key> = {
    Underweight: 'Bạn đang thiếu cân: tăng khẩu phần, ưu tiên thực phẩm giàu đạm và tập sức mạnh.',
    Normal: 'Cân nặng đang trong ngưỡng khỏe mạnh, hãy duy trì chế độ ăn và vận động hiện tại.',
    Overweight: 'Bạn hơi thừa cân: giảm 300–500 kcal mỗi ngày và tăng vận động tim mạch.',
    Obese: 'Bạn ở ngưỡng béo phì: nên giảm cân từ từ khoảng 0,5 kg/tuần và tham khảo ý kiến bác sĩ.',
  }
  out.push({ tone: a.bmiCategory === 'Normal' ? 'ok' : 'warn', text: t(bmiText[a.bmiCategory]) })
  if (p.goal === 'LoseWeight' && a.bmiCategory === 'Underweight')
    out.push({ tone: 'warn', text: t('Mục tiêu giảm cân không phù hợp khi đang thiếu cân.') })
  if (p.goal === 'GainWeight' && (a.bmiCategory === 'Obese' || a.bmiCategory === 'Overweight'))
    out.push({ tone: 'warn', text: t('Mục tiêu tăng cân không phù hợp khi đang thừa cân.') })
  if (p.targetWeightKg != null && (p.targetWeightKg < a.healthyWeightMinKg || p.targetWeightKg > a.healthyWeightMaxKg))
    out.push({
      tone: 'warn',
      text: t('Cân nặng mục tiêu nằm ngoài khoảng khỏe mạnh ({min}–{max} kg).', { min: num(a.healthyWeightMinKg), max: num(a.healthyWeightMaxKg) }),
    })
  if (a.waistRisk) out.push({ tone: 'warn', text: t('Vòng eo vượt ngưỡng khuyến nghị: nguy cơ tim mạch và tiểu đường cao hơn.') })
  if (!a.isCalorieEstimated && Math.abs(a.dailyCalories - a.estimatedCalories) > a.estimatedCalories * 0.25)
    out.push({ tone: 'warn', text: t('Calo mục tiêu bạn đặt chênh nhiều so với mức ước tính ({kcal} kcal).', { kcal: a.estimatedCalories }) })
  const conditionText: Record<string, Key> = {
    JointPain: 'Đau khớp: ưu tiên bài tập ít tác động như đi bộ, đạp xe, bơi.',
    BackPain: 'Đau lưng: tránh gập bụng và nâng tạ nặng, tăng cường cơ lưng – mông nhẹ nhàng.',
    HeartOrBloodPressure: 'Tim mạch / huyết áp: chỉ tập cường độ nhẹ; hỏi ý kiến bác sĩ trước khi tăng cường độ.',
    Diabetes: 'Tiểu đường: hạn chế đồ ngọt, tinh bột trắng và chia nhỏ bữa ăn.',
  }
  for (const c of p.conditions) out.push({ tone: 'info', text: t(conditionText[c]) })
  out.push({ tone: 'info', text: t('Uống khoảng {ml} ml nước mỗi ngày.', { ml: a.waterMl }) })
  return out
}

const Big = ({ children }: { children: ReactNode }) => <Txt style={{ fontSize: 28, fontWeight: '700' }}>{children}</Txt>

function OverviewTab({ p }: { p: HealthProfileDto }) {
  const c = useColors()
  const a = p.assessment
  // BMI scale 15–35 → 0–100%; bands 18.5 / 23 / 25 → 17.5% / 40% / 50%
  const marker = Math.min(100, Math.max(0, ((a.bmi - 15) / 20) * 100))
  const bands: [number, string][] = [[17.5, UNDERWEIGHT], [22.5, c.success], [10, c.warn], [50, c.danger]]
  const toneColor = { ok: c.success, warn: c.warn, info: c.primary }
  return (
    <>
      <Card>
        <H2>{t('Chỉ số khối cơ thể (BMI)')}</H2>
        <Row>
          <Big>{num(a.bmi)}</Big>
          <BmiPill cat={a.bmiCategory} />
        </Row>
        <View style={{ height: 18, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden' }}>
            {bands.map(([w, color]) => <View key={color} style={{ width: `${w}%`, backgroundColor: color }} />)}
          </View>
          <View style={{ position: 'absolute', left: `${marker}%`, marginLeft: -2, width: 4, height: 18, borderRadius: 2, backgroundColor: c.text }} />
        </View>
        <Muted style={{ fontSize: 12 }}>{t('Ngưỡng cho người châu Á: < 18,5 thiếu cân · 18,5–22,9 bình thường · 23–24,9 thừa cân · ≥ 25 béo phì')}</Muted>
      </Card>

      <Card>
        <H2>{t('Cân nặng')}</H2>
        <Big>{num(p.weightKg)} kg</Big>
        <Muted>{t('Khoảng khỏe mạnh: {min}–{max} kg', { min: num(a.healthyWeightMinKg), max: num(a.healthyWeightMaxKg) })}</Muted>
        {p.targetWeightKg != null && (
          <Txt>
            {t('Mục tiêu: {kg} kg', { kg: num(p.targetWeightKg) })}
            {a.weeksToTarget ? ` · ${t('khoảng {n} tuần (0,5 kg/tuần)', { n: a.weeksToTarget })}` : ` · ${t('đã đạt')}`}
          </Txt>
        )}
      </Card>

      <Card>
        <H2>{t('Năng lượng mỗi ngày')}</H2>
        <Big>{a.dailyCalories} kcal</Big>
        <Row>
          <Tag>{a.isCalorieEstimated ? t('Ước tính') : t('Tự đặt')}</Tag>
          <Muted>{t('BMR {bmr} · TDEE {tdee} kcal', { bmr: a.bmr, tdee: a.tdee })}</Muted>
        </Row>
        <MacroRow>
          <Macro label={`🥩 ${t('Đạm')}`} value={`${a.proteinG} g`} />
          <Macro label={`🍚 ${t('Tinh bột')}`} value={`${a.carbsG} g`} />
          <Macro label={`🥑 ${t('Chất béo')}`} value={`${a.fatG} g`} />
          <Macro label={`💧 ${t('Nước')}`} value={`${num(a.waterMl / 1000)} L`} />
        </MacroRow>
      </Card>

      <Card>
        <H2>{t('Đánh giá tổng quát')}</H2>
        {advice(p).map((x, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }}>
            <Txt style={{ color: toneColor[x.tone] }}>●</Txt>
            <Txt style={{ flex: 1 }}>{x.text}</Txt>
          </Row>
        ))}
        {p.conditions.length > 0 && <Muted>{t('Tình trạng:')} {p.conditions.map((c) => t(labelOf(CONDITIONS, c))).join(', ')}</Muted>}
        {p.notes && <Muted>{p.notes}</Muted>}
      </Card>
    </>
  )
}

// ---------- progress ----------

function ProgressTab({ p }: { p: HealthProfileDto }) {
  const c = useColors()
  const { data: list = [], isPending } = useMeasurements(p.id)
  const remove = useRemoveMeasurement()
  const dateFormat = usePreferences().data?.dateFormat
  const fmt = (key: string) => formatDate(parseDateKey(key)!, dateFormat)

  return (
    <>
      <CheckInCard key={p.checkInEveryDays ?? 0} p={p} />
      {list[0] && <BodyStatsCard p={p} m={list[0]} fmt={fmt} />}
      <MeasurementForm p={p} />
      <Card>
        <H2>{t('Biểu đồ cân nặng')}</H2>
        {list.length < 2 ? <Muted>{t('Cần ít nhất 2 lần đo để vẽ biểu đồ.')}</Muted> : <WeightChart list={list} p={p} fmt={fmt} />}
      </Card>
      <Card style={{ gap: 0 }}>
        <H2 style={{ marginBottom: 6 }}>{t('Lịch sử đo')}</H2>
        {isPending ? <Loading /> : list.map((m, i) => {
          const prev = list[i + 1]
          const diff = prev ? m.weightKg - prev.weightKg : 0
          const s = bodyStats(p, m)
          return (
            <Row key={m.id} style={{ borderTopWidth: 1, borderColor: c.border, paddingVertical: 8, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <RowBetween>
                  <Txt style={{ fontWeight: '600' }}>{fmt(m.date)}</Txt>
                  <Txt>
                    {num(m.weightKg)} kg{' '}
                    {diff !== 0 && (
                      <Txt style={{ fontSize: 12, color: diff > 0 ? c.warn : c.success }}>{diff > 0 ? '▲' : '▼'} {num(Math.abs(diff))}</Txt>
                    )}
                  </Txt>
                </RowBetween>
                <Muted style={{ fontSize: 13 }}>
                  BMI {num(s.bmi)} · {t('Mỡ cơ thể')} {s.fatSource === 'measured' ? '' : '~'}{num(s.fat)}% · {t('Vòng eo')}{' '}
                  {m.waistCm != null ? `${num(m.waistCm)} cm` : '—'}
                </Muted>
              </View>
              {list.length > 1 && (
                <IconButton label={t('Xóa')} onPress={() => !remove.isPending && remove.mutate({ id: p.id, mid: m.id })}>×</IconButton>
              )}
            </Row>
          )
        })}
      </Card>
    </>
  )
}

function CheckInCard({ p }: { p: HealthProfileDto }) {
  const c = useColors()
  const update = useUpdateProfile()
  const [days, setDays] = useState(p.checkInEveryDays ? String(p.checkInEveryDays) : '')
  const n = parseNum(days)
  const valid = !days.trim() || (n != null && Number.isInteger(n) && n >= 1 && n <= 365)
  const unchanged = (n ?? null) === p.checkInEveryDays
  const due = checkInDue(p)
  const since = daysSinceMeasured(p)
  return (
    <Card style={due ? { borderLeftWidth: 4, borderLeftColor: c.warn } : undefined}>
      <H2>🔔 {t('Nhắc đánh giá lại chỉ số')}</H2>
      {due && <Txt style={{ fontWeight: '700' }}>{t('Đã đến lúc đánh giá lại chỉ số cơ thể.')}</Txt>}
      {since != null && <Muted>{since === 0 ? t('Lần đo gần nhất: hôm nay.') : t('Lần đo gần nhất: {n} ngày trước.', { n: since })}</Muted>}
      <Row>
        <Txt>{t('Nhắc tôi đo lại sau')}</Txt>
        <Input keyboardType="number-pad" value={days} onChangeText={setDays} invalid={!valid} style={{ width: 70, paddingVertical: 6 }}
          accessibilityLabel={t('Nhắc tôi đo lại sau')} />
        <Txt>{t('ngày')}</Txt>
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        {[7, 14, 30].map((d) => <Chip key={d} label={t('{n} ngày', { n: d })} active={days === String(d)} onPress={() => setDays(String(d))} />)}
        <Button small title={t('Lưu')} disabled={!valid || unchanged} busy={update.isPending}
          onPress={() => update.mutate({ id: p.id, body: withCheckIn(p, n && Math.round(n)) })} />
      </Row>
      {!valid && <ErrorText>{t('Nhập số ngày từ 1 đến 365, hoặc để trống để tắt.')}</ErrorText>}
      <Muted style={{ fontSize: 12 }}>
        {p.nextCheckInAt
          ? t('Lần nhắc tiếp theo: {date}. Tính từ ngày đo gần nhất, nhắc lúc 8:00 sáng.', {
              date: new Date(p.nextCheckInAt).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }),
            })
          : t('Đang tắt nhắc nhở.')}
      </Muted>
    </Card>
  )
}

const FAT_SOURCE: Record<'measured' | 'waist' | 'bmi', Key> = {
  measured: 'Số bạn nhập',
  waist: 'Ước tính từ vòng eo và chiều cao (RFM)',
  bmi: 'Ước tính từ BMI, tuổi, giới tính (Deurenberg) – nhập vòng eo để chính xác hơn',
}

/** Derived numbers from the latest measurement. */
function BodyStatsCard({ p, m, fmt }: { p: HealthProfileDto; m: MeasurementDto; fmt: (k: string) => string }) {
  const s = bodyStats(p, m)
  return (
    <Card>
      <H2>{t('Chỉ số cơ thể ({date})', { date: fmt(m.date) })}</H2>
      <Row style={{ flexWrap: 'wrap' }}>
        <BmiPill cat={s.bmiCategory} bmi={s.bmi} />
        <Tag>{t(FAT_LEVEL_LABEL[s.fatLevel])}</Tag>
      </Row>
      <MacroRow>
        <Macro label={t('Mỡ cơ thể')} value={`${s.fatSource === 'measured' ? '' : '~'}${num(s.fat)}%`} />
        <Macro label={t('Khối mỡ')} value={`${num(s.fatKg)} kg`} />
        <Macro label={t('Khối nạc (cơ, xương, nước)')} value={`${num(s.leanKg)} kg`} />
        <Macro label={t('Vòng eo / chiều cao')}
          value={s.whtr != null ? `${num(s.whtr, 2)} · ${s.whtr >= 0.5 ? t('Nên giảm vòng eo') : t('Tốt')}` : '—'} />
      </MacroRow>
      <Muted style={{ fontSize: 12 }}>{t('Mỡ cơ thể:')} {t(FAT_SOURCE[s.fatSource])}. {t('Vòng eo nên nhỏ hơn một nửa chiều cao.')}</Muted>
    </Card>
  )
}

function MeasurementForm({ p }: { p: HealthProfileDto }) {
  const add = useAddMeasurement()
  const dateFormat = usePreferences().data?.dateFormat
  const [v, setV] = useState(() => ({ date: toDateKey(new Date()), weight: '', height: '', fat: '', waist: '' }))
  const [error, setError] = useState('')
  const set = (k: keyof typeof v) => (s: string) => setV({ ...v, [k]: s })

  const submit = () => {
    const weight = parseNum(v.weight)
    if (weight == null || weight < 10 || weight > 400) return setError(t('Nhập cân nặng từ 10 đến 400 kg.'))
    if (v.date > toDateKey(new Date())) return setError(t('Ngày đo không được ở tương lai.'))
    setError('')
    add.mutate(
      { id: p.id, body: { date: v.date, weightKg: weight, heightCm: parseNum(v.height), bodyFatPercent: parseNum(v.fat), waistCm: parseNum(v.waist) } },
      {
        onSuccess: () => setV({ ...v, weight: '', height: '', fat: '', waist: '' }),
        onError: (err) => setError(applyServerErrors(err)),
      },
    )
  }

  const half = { flex: 1, minWidth: 130 }
  return (
    <Card>
      <H2>{t('Ghi chỉ số mới')}</H2>
      <Field label={t('Ngày đo')}><DateInput value={v.date} onChange={set('date')} pattern={dateFormat} maximumDate={new Date()} /></Field>
      <Row style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <View style={half}><Field label={t('Cân nặng (kg)')}><Input keyboardType="decimal-pad" value={v.weight} onChangeText={set('weight')} placeholder={num(p.weightKg)} /></Field></View>
        <View style={half}><Field label={t('Chiều cao (cm)')}><Input keyboardType="decimal-pad" value={v.height} onChangeText={set('height')} placeholder={num(p.heightCm)} /></Field></View>
        <View style={half}><Field label={t('Mỡ cơ thể (%)')}><Input keyboardType="decimal-pad" value={v.fat} onChangeText={set('fat')} /></Field></View>
        <View style={half}><Field label={t('Vòng eo (cm)')}><Input keyboardType="decimal-pad" value={v.waist} onChangeText={set('waist')} /></Field></View>
      </Row>
      <Button title={add.isPending ? t('Đang lưu…') : t('Lưu chỉ số')} busy={add.isPending} onPress={submit} />
      <ErrorText>{error && tx(error)}</ErrorText>
    </Card>
  )
}

function WeightChart({ list, p, fmt }: { list: MeasurementDto[]; p: HealthProfileDto; fmt: (k: string) => string }) {
  const c = useColors()
  const [sel, setSel] = useState<MeasurementDto | null>(null)
  const pts = [...list].reverse()
  const W = 640, H = 260, pad = 36
  const values = pts.map((m) => m.weightKg).concat(p.targetWeightKg ?? [])
  const lo = Math.floor(Math.min(...values) - 1), hi = Math.ceil(Math.max(...values) + 1)
  const t0 = parseDateKey(pts[0].date)!.getTime(), t1 = parseDateKey(pts.at(-1)!.date)!.getTime()
  const x = (d: string) => pad + ((parseDateKey(d)!.getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad)
  const y = (kg: number) => H - pad - ((kg - lo) / (hi - lo)) * (H - 2 * pad)
  const label = { fill: c.muted, fontSize: 20 }
  return (
    <>
      <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', aspectRatio: W / H }} accessibilityLabel={t('Biểu đồ cân nặng')}>
        <SvgText x={4} y={y(hi) + 6} {...label}>{hi}</SvgText>
        <SvgText x={4} y={y(lo) + 6} {...label}>{lo}</SvgText>
        {p.targetWeightKg != null && (
          <>
            <Line x1={pad} x2={W - pad} y1={y(p.targetWeightKg)} y2={y(p.targetWeightKg)} stroke={c.success} strokeWidth={2} strokeDasharray="8 6" />
            <SvgText x={W - pad} y={y(p.targetWeightKg) - 8} textAnchor="end" {...label}>{`${t('Mục tiêu')} ${num(p.targetWeightKg)}`}</SvgText>
          </>
        )}
        <Polyline points={pts.map((m) => `${x(m.date)},${y(m.weightKg)}`).join(' ')} fill="none" stroke={c.primary} strokeWidth={3} />
        {pts.map((m) => (
          <Circle key={m.id} cx={x(m.date)} cy={y(m.weightKg)} r={sel?.id === m.id ? 9 : 6} fill={c.surface} stroke={c.primary} strokeWidth={3}
            onPress={() => setSel(m)} />
        ))}
        <SvgText x={pad} y={H - 8} {...label}>{fmt(pts[0].date)}</SvgText>
        <SvgText x={W - pad} y={H - 8} textAnchor="end" {...label}>{fmt(pts.at(-1)!.date)}</SvgText>
      </Svg>
      {/* web shows this as a hover <title>; tap a point on mobile */}
      {sel && <Muted style={{ textAlign: 'center' }}>{`${fmt(sel.date)}: ${num(sel.weightKg)} kg`}</Muted>}
    </>
  )
}

