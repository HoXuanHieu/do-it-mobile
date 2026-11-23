import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { t, type Key } from '../../i18n'
import { Button, Card, ErrorText, Fab, H2, Loading, Muted, Row, RowBetween, Screen, Segmented, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import type { GoalDto, GoalPeriod, GoalStatus } from './api'
import { GoalFormDialog, type GoalFormMode } from './GoalFormDialog'
import { activeByUrgency, daysLeft, nextStep, PERIODS, progressOf, useGoals, useUpdateStep } from './queries'
import { DueBadge, PERIOD_COLOR, ProgressRing } from './widgets'

const QUOTES: Key[] = [
  'Mỗi bước nhỏ hôm nay là một bước gần hơn tới đích.',
  'Kỷ luật là cầu nối giữa mục tiêu và thành tựu.',
  'Đừng đợi động lực, hãy bắt đầu và động lực sẽ đến.',
  'Thành công là tổng của những nỗ lực nhỏ lặp lại mỗi ngày.',
  'Tập trung vào tiến bộ, không phải sự hoàn hảo.',
]

const STATUS_TABS: { value: GoalStatus; label: Key }[] = [
  { value: 'Active', label: 'Đang thực hiện' },
  { value: 'Completed', label: 'Đã hoàn thành' },
  { value: 'Abandoned', label: 'Đã tạm dừng' },
]

export function GoalsPage() {
  const c = useColors()
  const { data: goals, isPending, isError } = useGoals()
  const { goal: legacyId } = useLocalSearchParams<{ goal?: string }>()
  const [status, setStatus] = useState<GoalStatus>('Active')
  const [period, setPeriod] = useState<GoalPeriod | null>(null)
  const [form, setForm] = useState<GoalFormMode | null>(null)
  const [quote] = useState(() => QUOTES[new Date().getDate() % QUOTES.length])

  const all = goals ?? []
  const active = activeByUrgency(all)
  const focus = active[0]
  const shown = all
    .filter((g) => g.status === status && (!period || g.period === period))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Older reminder notifications link to /goals?goal=<id>.
  if (legacyId) return <Redirect href={`/goals/${legacyId}`} />

  return (
    <View style={{ flex: 1 }}>
      <Screen style={{ paddingBottom: 96 }}>
        <Muted style={{ fontStyle: 'italic' }}>“{t(quote)}”</Muted>

        {isPending && <Loading />}
        {isError && <ErrorText>{t('Không tải được mục tiêu.')}</ErrorText>}

        {goals && all.length === 0 && (
          <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 52 }} accessibilityElementsHidden>🎯</Text>
            <H2 style={{ textAlign: 'center' }}>{t('Bắt đầu với mục tiêu đầu tiên')}</H2>
            <Muted style={{ textAlign: 'center' }}>{t('Viết ra điều bạn muốn đạt được, chia nhỏ thành từng chặng và để DO-IT nhắc bạn mỗi ngày.')}</Muted>
            <Button title={t('Tạo mục tiêu')} onPress={() => setForm({ kind: 'create' })} />
          </Card>
        )}

        {focus && <FocusHero goal={focus} />}

        {all.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Stat value={active.length} label="Đang thực hiện" tone={c.primary} />
              <Stat value={all.filter((g) => g.status === 'Completed').length} label="Đã hoàn thành" tone={c.success} />
              <Stat value={active.filter((g) => daysLeft(g) < 0).length} label="Quá hạn" tone={c.danger} />
              <Stat
                value={`${active.length ? Math.round(active.reduce((s, g) => s + progressOf(g), 0) / active.length) : 0}%`}
                label="Tiến độ trung bình"
                tone={c.warn}
              />
            </View>

            <Segmented
              value={status}
              onChange={setStatus}
              options={STATUS_TABS.map((s) => ({ value: s.value, label: `${t(s.label)} (${all.filter((g) => g.status === s.value).length})` }))}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Chip label={t('Tất cả')} active={period === null} onPress={() => setPeriod(null)} />
              {PERIODS.map((p) => (
                <Chip key={p.value} label={`${p.icon} ${t(p.label)}`} active={period === p.value} onPress={() => setPeriod(p.value)} />
              ))}
            </ScrollView>

            {shown.length === 0 ? (
              <Muted style={{ textAlign: 'center', paddingVertical: 16 }}>{t('Không có mục tiêu nào ở đây.')}</Muted>
            ) : (
              shown.map((g) => <GoalCard key={g.id} goal={g} />)
            )}
          </>
        )}
      </Screen>
      <Fab label={t('+ Mục tiêu mới')} onPress={() => setForm({ kind: 'create' })} />
      <GoalFormDialog mode={form} onClose={() => setForm(null)} />
    </View>
  )
}

/** web .goal-chip: filled with the text color when active. */
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: active ? c.text : c.border, backgroundColor: active ? c.text : c.surface }}
    >
      <Text style={{ color: active ? c.surface : c.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  )
}

function Stat({ value, label, tone }: { value: number | string; label: Key; tone: string }) {
  const c = useColors()
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, borderLeftColor: tone }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: tone }}>{value}</Text>
      <Muted style={{ fontSize: 13 }}>{t(label)}</Muted>
    </View>
  )
}

/** The most urgent active goal, front and centre. */
function FocusHero({ goal }: { goal: GoalDto }) {
  const toggle = useUpdateStep()
  const step = nextStep(goal)
  const days = daysLeft(goal)
  const color = PERIOD_COLOR[goal.period]
  return (
    <View style={{ backgroundColor: color, borderRadius: 18, padding: 18, gap: 12 }}>
      <Row style={{ gap: 14 }}>
        <ProgressRing percent={progressOf(goal)} size={88} color="#fff" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{t('Tiêu điểm của bạn')}</Text>
          <Text accessibilityRole="link" onPress={() => router.push(`/goals/${goal.id}`)} style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
            {goal.title}
          </Text>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 10, minWidth: 76 }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{Math.abs(days)}</Text>
          <Text style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>{days < 0 ? t('ngày quá hạn') : days === 0 ? t('hạn chót hôm nay') : t('ngày còn lại')}</Text>
        </View>
      </Row>
      {step ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Text style={{ color: '#fff' }}>{t('Việc cần làm tiếp:')}</Text>
          <Text style={{ color: '#fff', fontWeight: '700', flexShrink: 1 }}>{step.title}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={toggle.isPending}
            onPress={() => toggle.mutate({ id: goal.id, stepId: step.id, isDone: true })}
            style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, opacity: toggle.isPending ? 0.6 : 1 }}
          >
            <Text style={{ color, fontWeight: '700' }}>{t('✓ Đã xong')}</Text>
          </Pressable>
        </Row>
      ) : (
        <Text style={{ color: '#fff' }}>{goal.steps.length ? t('Mọi chặng đã xong, hãy đánh dấu hoàn thành!') : t('Hãy chia mục tiêu thành các chặng nhỏ.')}</Text>
      )}
    </View>
  )
}

function GoalCard({ goal }: { goal: GoalDto }) {
  const c = useColors()
  const step = nextStep(goal)
  const done = goal.steps.filter((s) => s.isDone).length
  const period = PERIODS.find((p) => p.value === goal.period)!
  const color = PERIOD_COLOR[goal.period]
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/goals/${goal.id}`)}
      style={({ pressed }) => ({
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        borderTopWidth: 5,
        borderTopColor: color,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        opacity: goal.status === 'Abandoned' ? 0.65 : pressed ? 0.85 : 1,
      })}
    >
      <RowBetween>
        <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
          {period.icon} {t(period.label)}
        </Text>
        <DueBadge goal={goal} />
      </RowBetween>
      <Row style={{ gap: 12 }}>
        <ProgressRing percent={progressOf(goal)} size={56} color={color} />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontSize: 16, fontWeight: '700' }}>{goal.title}</Txt>
          {goal.steps.length > 0 && <Muted style={{ fontSize: 12 }}>{t('{done}/{total} chặng', { done, total: goal.steps.length })}</Muted>}
        </View>
      </Row>
      {goal.status === 'Active' && step && (
        <View style={{ backgroundColor: color + '17', borderRadius: 8, padding: 8 }}>
          <Txt style={{ fontSize: 14 }}>
            <Text style={{ color, fontWeight: '700' }}>➜ </Text>
            {step.title}
          </Txt>
        </View>
      )}
      {goal.reminderTime && goal.status === 'Active' && (
        <Muted style={{ fontSize: 12 }}>🔔 {t('Nhắc lúc {time} mỗi ngày', { time: goal.reminderTime.slice(0, 5) })}</Muted>
      )}
    </Pressable>
  )
}
