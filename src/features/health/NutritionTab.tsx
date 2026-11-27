import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { t, tx } from '../../i18n'
import { addDays, DAY_MS, parseDateKey, toDateKey, weekdayName } from '../../lib/dates'
import { applyServerErrors } from '../../lib/forms'
import {
  Bar, Button, Card, ConfirmDialog, ErrorText, Field, H2, IconButton, Input, LinkText, Loading, Muted, Row, RowBetween, Select, Sheet, SheetActions, Txt,
} from '../../ui/components'
import { DateInput } from '../../ui/DatePicker'
import { useColors, type Colors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { FoodEntryDto, FoodEntryInput, HealthProfileDto, MealType } from './api'
import { suggestMenu } from './catalog'
import { Checkbox, Chip, Macro, MacroRow, Tag } from './parts'
import { MEALS, num, parseNum, useDishes, useFoods, useRemoveFood, useSaveFood } from './queries'

const sum = (list: FoodEntryDto[], f: (e: FoodEntryDto) => number | null) => list.reduce((s, e) => s + (f(e) ?? 0), 0)

type Verdict = 'none' | 'low' | 'ok' | 'over'
const verdictColor = (v: Verdict, c: Colors) => ({ none: c.primary, low: c.warn, ok: c.success, over: c.danger })[v]

/** Eaten vs target: under 80% low, 80–110% on target, above over. */
function verdict(eaten: number, target: number): { cls: Verdict; text: string } {
  const r = eaten / target
  if (eaten === 0) return { cls: 'none', text: t('Chưa ghi món nào hôm nay.') }
  if (r < 0.8) return { cls: 'low', text: t('Còn thiếu {kcal} kcal so với mục tiêu.', { kcal: Math.round(target - eaten) }) }
  if (r <= 1.1) return { cls: 'ok', text: t('Đạt mục tiêu năng lượng, tốt lắm!') }
  return { cls: 'over', text: t('Vượt {kcal} kcal so với mục tiêu.', { kcal: Math.round(eaten - target) }) }
}

export function NutritionTab({ p }: { p: HealthProfileDto }) {
  const c = useColors()
  const dateFormat = usePreferences().data?.dateFormat
  const [day, setDay] = useState(() => toDateKey(new Date()))
  const date = parseDateKey(day)!
  const from = toDateKey(addDays(date, -6))
  const { data: week = [], isPending } = useFoods(p.id, from, day)
  const save = useSaveFood(p.id)
  const remove = useRemoveFood(p.id)
  const [dialog, setDialog] = useState<{ entry?: FoodEntryDto; meal: MealType } | null>(null)
  const [deleting, setDeleting] = useState<FoodEntryDto | null>(null)

  const target = p.assessment.dailyCalories
  const entries = week.filter((e) => e.date === day)
  const eaten = entries.filter((e) => !e.isPlanned)
  const planned = entries.filter((e) => e.isPlanned)
  const kcal = sum(eaten, (e) => e.calories)
  const v = verdict(kcal, target)
  const menu = suggestMenu(target, p.conditions, Math.round(date.getTime() / DAY_MS), MEALS)

  const applyMenu = () =>
    Promise.all(
      menu.map((m) =>
        save.mutateAsync({
          body: {
            date: day, meal: m.meal, name: t(m.dish.name), quantity: m.servings, unit: t(m.dish.unit), calories: m.kcal,
            proteinG: Math.round(m.dish.p * m.servings), carbsG: Math.round(m.dish.c * m.servings), fatG: Math.round(m.dish.f * m.servings),
            isPlanned: true,
          },
        }),
      ),
    )

  const markEaten = (e: FoodEntryDto) => {
    const { id, ...body } = e
    save.mutate({ id, body: { ...body, isPlanned: false } })
  }

  return (
    <>
      <Row>
        <Button variant="outline" small title="‹" onPress={() => setDay(toDateKey(addDays(date, -1)))} />
        <View style={{ flex: 1 }}><DateInput value={day} onChange={(d) => d && setDay(d)} pattern={dateFormat} /></View>
        <Button variant="outline" small title="›" onPress={() => setDay(toDateKey(addDays(date, 1)))} />
        <LinkText onPress={() => setDay(toDateKey(new Date()))}>{t('Hôm nay')}</LinkText>
      </Row>

      <Card style={{ borderLeftWidth: 4, borderLeftColor: verdictColor(v.cls, c) }}>
        <RowBetween style={{ flexWrap: 'wrap' }}>
          <H2>{t('Năng lượng đã nạp')}</H2>
          <Row>
            <Txt><Txt style={{ fontWeight: '700' }}>{kcal}</Txt> / {target} kcal</Txt>
            {p.assessment.isCalorieEstimated && <Tag>{t('Ước tính')}</Tag>}
          </Row>
        </RowBetween>
        <Bar percent={(kcal / target) * 100} color={verdictColor(v.cls, c)} />
        <Txt>{v.text}</Txt>
        <MacroRow>
          <Macro label={`🥩 ${t('Đạm')}`} value={`${num(sum(eaten, (e) => e.proteinG), 0)}/${p.assessment.proteinG} g`} />
          <Macro label={`🍚 ${t('Tinh bột')}`} value={`${num(sum(eaten, (e) => e.carbsG), 0)}/${p.assessment.carbsG} g`} />
          <Macro label={`🥑 ${t('Chất béo')}`} value={`${num(sum(eaten, (e) => e.fatG), 0)}/${p.assessment.fatG} g`} />
        </MacroRow>
        {planned.length > 0 && <Muted>🗓 {t('Đã lên kế hoạch thêm {kcal} kcal', { kcal: sum(planned, (e) => e.calories) })}</Muted>}
      </Card>

      <Card>
        <H2>{t('Nhật ký ăn uống')}</H2>
        {isPending && <Loading />}
        {MEALS.map((m) => {
          const items = entries.filter((e) => e.meal === m.value)
          return (
            <View key={m.value} style={{ paddingBottom: 8, borderBottomWidth: 1, borderColor: c.border, gap: 6 }}>
              <RowBetween>
                <Txt style={{ fontWeight: '700' }}>
                  {m.icon} {t(m.label)} <Muted style={{ fontSize: 13 }}>{sum(items.filter((e) => !e.isPlanned), (e) => e.calories)} kcal</Muted>
                </Txt>
                <LinkText onPress={() => setDialog({ meal: m.value })}>{t('+ Thêm món')}</LinkText>
              </RowBetween>
              {items.map((e) => (
                <Row key={e.id} style={{ padding: 6, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: e.isPlanned ? c.border : 'transparent', backgroundColor: e.isPlanned ? c.bg : undefined }}>
                  <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => setDialog({ entry: e, meal: e.meal })}>
                    <Txt>{e.name} <Muted style={{ fontSize: 13 }}>{num(e.quantity)} {e.unit}</Muted></Txt>
                  </Pressable>
                  <Txt style={{ fontSize: 14 }}>{e.calories} kcal</Txt>
                  {e.isPlanned && <Button small variant="outline" title={t('✓ Đã ăn')} disabled={save.isPending} onPress={() => markEaten(e)} />}
                  <IconButton label={t('Xóa')} onPress={() => setDeleting(e)}>×</IconButton>
                </Row>
              ))}
            </View>
          )
        })}
        <Muted style={{ fontSize: 12 }}>{t('Món có viền nét đứt là món đã lên kế hoạch, chưa tính vào năng lượng đã nạp.')}</Muted>
      </Card>

      <Card>
        <H2>🍽 {t('Gợi ý thực đơn')}</H2>
        <Muted>{t('Theo mục tiêu {kcal} kcal/ngày và tình trạng sức khỏe của hồ sơ.', { kcal: target })}</Muted>
        {menu.map((m) => (
          <View key={m.meal} style={{ padding: 10, borderRadius: 8, backgroundColor: c.bg, gap: 2 }}>
            <Muted style={{ fontSize: 13 }}>{t(MEALS.find((x) => x.value === m.meal)!.label)}</Muted>
            <Txt style={{ fontWeight: '700' }}>{t(m.dish.name)}</Txt>
            <Txt style={{ fontSize: 13 }}>{num(m.servings)} {t(m.dish.unit)} · {m.kcal} kcal</Txt>
          </View>
        ))}
        <Txt style={{ fontWeight: '700' }}>{t('Tổng: {kcal} kcal', { kcal: menu.reduce((s, m) => s + m.kcal, 0) })}</Txt>
        <Button title={t('Thêm vào kế hoạch ngày này')} disabled={save.isPending} onPress={() => void applyMenu().catch(() => {})} />
        {save.isError && <ErrorText>{t('Không lưu được, vui lòng thử lại.')}</ErrorText>}
      </Card>

      <Card>
        <H2>{t('7 ngày gần nhất')}</H2>
        <View style={{ height: 160 }}>
          <Row style={{ flex: 1, alignItems: 'stretch', gap: 6 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(date, i - 6)
              const k = toDateKey(d)
              const total = sum(week.filter((e) => e.date === k && !e.isPlanned), (e) => e.calories)
              const cls = verdict(total, target).cls
              return (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${k}: ${total} kcal`} onPress={() => setDay(k)}
                  style={{ flex: 1, alignItems: 'center', borderRadius: 6, backgroundColor: k === day ? c.bg : undefined }}>
                  <View style={{ flex: 1, width: '60%', justifyContent: 'flex-end' }}>
                    <View style={{ height: `${Math.min(100, (total / target) * 80)}%`, minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                      backgroundColor: cls === 'none' ? c.border : verdictColor(cls, c) }} />
                  </View>
                  <Txt style={{ fontSize: 12 }}>{weekdayName(d)}</Txt>
                  <Muted style={{ fontSize: 11 }}>{total}</Muted>
                </Pressable>
              )
            })}
          </Row>
          {/* target line at 80% of the bar area (labels take ~34px) */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 34 + (160 - 34) * 0.8, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.muted }} />
        </View>
        <Muted style={{ fontSize: 12 }}>{t('Vạch ngang là mục tiêu năng lượng mỗi ngày.')}</Muted>
      </Card>

      <FoodDialog state={dialog} day={day} profileId={p.id} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={!!deleting}
        title={t('Xóa món ăn?')}
        message={deleting?.name ?? ''}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  )
}

function FoodDialog({ state, day, profileId, onClose }: {
  state: { entry?: FoodEntryDto; meal: MealType } | null
  day: string
  profileId: string
  onClose: () => void
}) {
  return (
    <Sheet open={!!state} title={state?.entry ? t('Sửa món ăn') : t('Thêm món ăn')} onClose={onClose}>
      {state && <FoodForm key={state.entry?.id ?? state.meal} state={state} day={day} profileId={profileId} onClose={onClose} />}
    </Sheet>
  )
}

function FoodForm({ state, day, profileId, onClose }: {
  state: { entry?: FoodEntryDto; meal: MealType }
  day: string
  profileId: string
  onClose: () => void
}) {
  const save = useSaveFood(profileId)
  const e = state.entry
  const str = (n: number | null | undefined) => (n == null ? '' : String(n))
  const [v, setV] = useState({
    meal: state.meal, name: e?.name ?? '', quantity: str(e?.quantity ?? 1), unit: e?.unit ?? t('phần'),
    calories: str(e?.calories), protein: str(e?.proteinG), carbs: str(e?.carbsG), fat: str(e?.fatG), isPlanned: e?.isPlanned ?? false,
  })
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const set = (k: keyof typeof v) => (s: string) => setV({ ...v, [k]: s })

  // Catalog dish: nutrition comes from the shared catalog × quantity (the server recomputes it the same way).
  const { data: dishes = [] } = useDishes()
  const typed = v.name.trim().toLowerCase()
  const dish = dishes.find((d) => d.name.toLowerCase() === typed)
  const qty = parseNum(v.quantity) ?? 0
  const scaled = (n: number | null) => (n == null ? '' : String(Math.round(n * qty * 10) / 10))
  const shown = dish
    ? { ...v, unit: dish.unit, calories: String(Math.round(dish.calories * qty)), protein: scaled(dish.proteinG), carbs: scaled(dish.carbsG), fat: scaled(dish.fatG) }
    : v
  // web <datalist>: dish / category suggestions matching what was typed
  const matches = typed && !dish ? dishes.filter((d) => d.name.toLowerCase().includes(typed)).slice(0, 20) : []
  const categories = [...new Set(dishes.map((d) => d.category))].filter((c) => c.toLowerCase().includes(category.trim().toLowerCase()) && c !== category)

  const submit = async () => {
    const quantity = parseNum(shown.quantity), calories = parseNum(shown.calories)
    const macros = [shown.protein, shown.carbs, shown.fat].map(parseNum)
    if (!v.name.trim()) return setError(t('Nhập tên món.'))
    if (quantity == null || quantity <= 0) return setError(t('Số lượng phải lớn hơn 0.'))
    if (!shown.unit.trim()) return setError(t('Nhập đơn vị.'))
    if (calories == null || calories < 0) return setError(t('Calo không được âm.'))
    if (macros.some((m) => m != null && m < 0)) return setError(t('Đạm, tinh bột, chất béo không được âm.'))
    const body: FoodEntryInput = {
      date: e?.date ?? day, meal: v.meal, name: dish?.name ?? v.name.trim(), quantity, unit: shown.unit.trim(), calories: Math.round(calories),
      proteinG: macros[0], carbsG: macros[1], fatG: macros[2], isPlanned: v.isPlanned, category: category.trim() || undefined,
    }
    try {
      await save.mutateAsync({ id: e?.id, body })
      onClose()
    } catch (err) {
      setError(applyServerErrors(err))
    }
  }

  return (
    <>
      <Field label={t('Tên món')}>
        <Input autoFocus maxLength={200} value={v.name} onChangeText={set('name')} placeholder={t('Gõ hoặc chọn món gợi ý')} />
        {matches.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingTop: 4 }}>
            {matches.map((d) => <Chip key={d.id} label={d.name} onPress={() => set('name')(d.name)} />)}
          </ScrollView>
        )}
      </Field>
      {typed !== '' && (
        <Muted>
          {dish
            ? t('Món có sẵn: {kcal} kcal / 1 {unit}. Chỉ cần chỉnh số lượng, hệ thống tự tính lại.', { kcal: num(dish.calories), unit: dish.unit })
            : t('Món mới: sẽ được thêm vào danh sách món dùng chung cho mọi người.')}
        </Muted>
      )}
      <Field label={t('Danh mục')}>
        <Input maxLength={50} value={dish ? dish.category : category} editable={!dish} onChangeText={setCategory} />
        {!dish && categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingTop: 4 }}>
            {categories.map((c) => <Chip key={c} label={c} onPress={() => setCategory(c)} />)}
          </ScrollView>
        )}
      </Field>
      <Field label={t('Bữa')}>
        <Select label={t('Bữa')} value={v.meal} onChange={(meal) => setV({ ...v, meal })} options={MEALS.map((m) => ({ value: m.value, label: t(m.label) }))} />
      </Field>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label={t('Số lượng')}><Input keyboardType="decimal-pad" value={v.quantity} onChangeText={set('quantity')} /></Field></View>
        <View style={{ flex: 1 }}><Field label={t('Đơn vị')}><Input maxLength={30} value={shown.unit} editable={!dish} onChangeText={set('unit')} placeholder={t('g, bát, phần…')} /></Field></View>
      </Row>
      <Field label={t('Calo (kcal)')}><Input keyboardType="number-pad" value={shown.calories} editable={!dish} onChangeText={set('calories')} /></Field>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label={t('Đạm (g)')} hint={t('Không bắt buộc')}><Input keyboardType="decimal-pad" value={shown.protein} editable={!dish} onChangeText={set('protein')} /></Field></View>
        <View style={{ flex: 1 }}><Field label={t('Tinh bột (g)')} hint={t('Không bắt buộc')}><Input keyboardType="decimal-pad" value={shown.carbs} editable={!dish} onChangeText={set('carbs')} /></Field></View>
        <View style={{ flex: 1 }}><Field label={t('Chất béo (g)')} hint={t('Không bắt buộc')}><Input keyboardType="decimal-pad" value={shown.fat} editable={!dish} onChangeText={set('fat')} /></Field></View>
      </Row>
      <Checkbox label={t('Chỉ là kế hoạch (chưa ăn)')} checked={v.isPlanned} onChange={(isPlanned) => setV({ ...v, isPlanned })} />
      <ErrorText>{error && tx(error)}</ErrorText>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onClose} />
        <Button title={save.isPending ? t('Đang lưu…') : t('Lưu')} busy={save.isPending} onPress={() => void submit()} />
      </SheetActions>
    </>
  )
}
