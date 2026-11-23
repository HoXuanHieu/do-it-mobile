import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { locale, t, tx } from '../../i18n'
import { addDays, DAY_MS, parseDateKey, startOfWeek, toDateKey, weekdayName } from '../../lib/dates'
import { applyServerErrors } from '../../lib/forms'
import {
  Button, Card, ConfirmDialog, DateInput, ErrorText, Field, H2, Input, LinkText, Loading, Muted, Row, RowBetween, Sheet, SheetActions, TimeInput, Txt,
} from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { HealthProfileDto, WorkoutDto, WorkoutInput } from './api'
import { FOCUS_LABEL, maxLevel, suggestWeek, type PlanDay } from './catalog'
import { Checkbox, Macro, MacroRow } from './parts'
import { parseNum, useRemoveWorkout, useSaveWorkout, useWorkouts } from './queries'

const LEVEL_LABEL = { 1: 'nhẹ', 2: 'vừa', 3: 'cao' } as const

const planToInput = (day: PlanDay, date: string): WorkoutInput => ({
  date,
  time: null,
  name: t(FOCUS_LABEL[day.focus]),
  durationMinutes: day.minutes,
  exercises: day.exercises.map((e) => `${t(e.name)} — ${t(e.dose)}`).join('\n'),
  caloriesBurned: day.kcal,
  notes: null,
  isDone: false,
})

export function WorkoutTab({ p }: { p: HealthProfileDto }) {
  const c = useColors()
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const from = toDateKey(monday)
  const { data: sessions = [], isPending } = useWorkouts(p.id, from, toDateKey(addDays(monday, 6)))
  const save = useSaveWorkout(p.id)
  const remove = useRemoveWorkout(p.id)
  const [dialog, setDialog] = useState<{ workout?: WorkoutDto; date: string } | null>(null)
  const [deleting, setDeleting] = useState<WorkoutDto | null>(null)

  const input = { ...p, age: p.assessment.age, bmiCategory: p.assessment.bmiCategory }
  const plan = suggestWeek(input, Math.floor(monday.getTime() / (7 * DAY_MS)))
  const level = maxLevel(input)
  const done = sessions.filter((s) => s.isDone)
  const [todayKey] = useState(() => toDateKey(new Date()))
  // Suggestions only for days without a session and not in the past.
  const open = plan.filter((d) => {
    const key = toDateKey(addDays(monday, d.weekday))
    return key >= todayKey && !sessions.some((s) => s.date === key)
  })

  const toggle = (w: WorkoutDto) => {
    const { id, completedAt: _, ...body } = w
    save.mutate({ id, body: { ...body, isDone: !w.isDone } })
  }

  return (
    <>
      <Row>
        <Button variant="outline" small title="‹" onPress={() => setMonday(addDays(monday, -7))} />
        <Txt style={{ flex: 1, fontWeight: '700', textAlign: 'center' }}>
          {t('Tuần {from} – {to}', { from: monday.toLocaleDateString(locale()), to: addDays(monday, 6).toLocaleDateString(locale()) })}
        </Txt>
        <Button variant="outline" small title="›" onPress={() => setMonday(addDays(monday, 7))} />
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        <LinkText onPress={() => setMonday(startOfWeek(new Date()))}>{t('Tuần này')}</LinkText>
        <View style={{ flex: 1 }} />
        {open.length > 0 && (
          <Button small variant="outline" title={t('Thêm cả tuần gợi ý vào lịch')} disabled={save.isPending}
            onPress={() => void Promise.all(open.map((d) => save.mutateAsync({ body: planToInput(d, toDateKey(addDays(monday, d.weekday))) }))).catch(() => {})} />
        )}
        <Button small title={t('+ Buổi tập')} onPress={() => setDialog({ date: todayKey })} />
      </Row>

      <Card>
        <MacroRow>
          <Macro label={`✅ ${t('Đã hoàn thành')}`} value={`${done.length}/${sessions.length} ${t('buổi')}`} />
          <Macro label="⏱" value={`${done.reduce((s, w) => s + w.durationMinutes, 0)} ${t('phút')}`} />
          <Macro label="🔥" value={`${done.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0)} kcal`} />
        </MacroRow>
        <Muted>{t('Cường độ phù hợp: {level}', { level: t(LEVEL_LABEL[level]) })}</Muted>
        <Muted style={{ fontSize: 12 }}>
          {t('Lịch gợi ý dựa trên mục tiêu, mức vận động và tình trạng cơ thể; các bài không phù hợp với tình trạng của bạn đã được loại bỏ.')}
        </Muted>
      </Card>

      {isPending && <Loading />}
      {save.isError && <ErrorText>{t('Không lưu được, vui lòng thử lại.')}</ErrorText>}

      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i)
        const key = toDateKey(d)
        const daySessions = sessions.filter((s) => s.date === key)
        const suggestion = open.find((x) => x.weekday === i)
        return (
          <Card key={key} style={[{ gap: 8, padding: 12 }, key === todayKey && { borderColor: c.primary, borderWidth: 2 }]}>
            <RowBetween>
              <Txt style={{ fontWeight: '700' }}>{weekdayName(d, 'long')} <Muted style={{ fontSize: 13 }}>{d.toLocaleDateString(locale())}</Muted></Txt>
              <LinkText onPress={() => setDialog({ date: key })} style={{ fontSize: 22, paddingHorizontal: 6 }}>+</LinkText>
            </RowBetween>

            {daySessions.map((w) => (
              <View key={w.id} style={{ gap: 3, padding: 8, borderRadius: 8, backgroundColor: w.isDone ? c.successBg : c.bg }}>
                <Row>
                  <Checkbox label="" a11yLabel={w.name} checked={w.isDone} disabled={save.isPending} onChange={() => toggle(w)} />
                  <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => setDialog({ workout: w, date: w.date })}>
                    <Txt style={{ fontWeight: '600', color: w.isDone ? c.success : c.primary, textDecorationLine: w.isDone ? 'line-through' : 'none' }}>{w.name}</Txt>
                  </Pressable>
                </Row>
                <Muted style={{ fontSize: 13 }}>
                  {w.time && `${w.time.slice(0, 5)} · `}{w.durationMinutes} {t('phút')}{w.caloriesBurned ? ` · ~${w.caloriesBurned} kcal` : ''}
                </Muted>
                {w.exercises && <Txt style={{ fontSize: 13 }}>{w.exercises}</Txt>}
                <Txt style={{ color: c.danger, fontSize: 13, fontWeight: '600' }} onPress={() => setDeleting(w)}>{t('Xóa')}</Txt>
              </View>
            ))}

            {suggestion && <Suggestion day={suggestion} busy={save.isPending} onAdd={() => save.mutate({ body: planToInput(suggestion, key) })} />}
            {!daySessions.length && !suggestion && <Muted style={{ fontSize: 13 }}>{key < todayKey ? '—' : t('Nghỉ ngơi')}</Muted>}
          </Card>
        )
      })}

      <WorkoutDialog state={dialog} profileId={p.id} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={!!deleting}
        title={t('Xóa buổi tập?')}
        message={deleting?.name ?? ''}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  )
}

function Suggestion({ day, busy, onAdd }: { day: PlanDay; busy: boolean; onAdd: () => void }) {
  const c = useColors()
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <View style={{ gap: 4, padding: 8, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: c.primary }}>
      <Muted style={{ fontSize: 12 }}>{t('Gợi ý')}</Muted>
      <Txt style={{ fontWeight: '700' }}>{t(FOCUS_LABEL[day.focus])}</Txt>
      <Muted style={{ fontSize: 13 }}>{day.minutes} {t('phút')} · ~{day.kcal} kcal</Muted>
      {/* web <details>: tap an exercise to show how to do it */}
      {day.exercises.map((e) => (
        <Pressable key={e.name} accessibilityRole="button" accessibilityState={{ expanded: expanded === e.name }}
          onPress={() => setExpanded(expanded === e.name ? null : e.name)}>
          <Txt style={{ fontSize: 14 }}>{expanded === e.name ? '▾' : '▸'} {t(e.name)} <Muted style={{ fontSize: 12 }}>{t(e.dose)}</Muted></Txt>
          {expanded === e.name && <Txt style={{ fontSize: 13, paddingLeft: 14 }}>{t(e.how)}</Txt>}
        </Pressable>
      ))}
      <Button small variant="outline" title={t('+ Thêm vào lịch')} disabled={busy} onPress={onAdd} style={{ alignSelf: 'flex-start' }} />
    </View>
  )
}

function WorkoutDialog({ state, profileId, onClose }: { state: { workout?: WorkoutDto; date: string } | null; profileId: string; onClose: () => void }) {
  return (
    <Sheet open={!!state} title={state?.workout ? t('Sửa buổi tập') : t('Thêm buổi tập')} onClose={onClose}>
      {state && <WorkoutForm key={state.workout?.id ?? state.date} state={state} profileId={profileId} onClose={onClose} />}
    </Sheet>
  )
}

function WorkoutForm({ state, profileId, onClose }: { state: { workout?: WorkoutDto; date: string }; profileId: string; onClose: () => void }) {
  const save = useSaveWorkout(profileId)
  const dateFormat = usePreferences().data?.dateFormat
  const w = state.workout
  const [v, setV] = useState({
    name: w?.name ?? '', date: w?.date ?? state.date, time: w?.time?.slice(0, 5) ?? '', duration: String(w?.durationMinutes ?? 30),
    exercises: w?.exercises ?? '', kcal: w?.caloriesBurned == null ? '' : String(w.caloriesBurned), notes: w?.notes ?? '', isDone: w?.isDone ?? false,
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof v) => (s: string) => setV({ ...v, [k]: s })

  const submit = async () => {
    const duration = parseNum(v.duration), kcal = parseNum(v.kcal)
    if (!v.name.trim()) return setError(t('Nhập tên buổi tập.'))
    if (!parseDateKey(v.date)) return setError(t('Chọn ngày'))
    if (duration == null || duration < 1 || duration > 600) return setError(t('Thời lượng từ 1 đến 600 phút.'))
    if (kcal != null && kcal < 0) return setError(t('Calo không được âm.'))
    try {
      await save.mutateAsync({
        id: w?.id,
        body: {
          name: v.name.trim(), date: v.date, time: v.time ? `${v.time}:00` : null, durationMinutes: Math.round(duration),
          exercises: v.exercises.trim() || null, caloriesBurned: kcal == null ? null : Math.round(kcal), notes: v.notes.trim() || null, isDone: v.isDone,
        },
      })
      onClose()
    } catch (err) {
      setError(applyServerErrors(err))
    }
  }

  return (
    <>
      <Field label={t('Tên buổi tập')}><Input autoFocus maxLength={200} value={v.name} onChangeText={set('name')} placeholder={t('VD: Chạy bộ công viên')} /></Field>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 3 }}><Field label={t('Ngày')}><DateInput value={v.date} onChange={set('date')} pattern={dateFormat} /></Field></View>
        <View style={{ flex: 2 }}>
          <Field label={t('Giờ')} hint={t('Không bắt buộc')}>
            <TimeInput value={v.time} onChange={set('time')} />
            {v.time ? <LinkText style={{ fontSize: 13 }} onPress={() => setV({ ...v, time: '' })}>{t('Xóa')}</LinkText> : null}
          </Field>
        </View>
      </Row>
      <Field label={t('Thời lượng (phút)')}><Input keyboardType="number-pad" value={v.duration} onChangeText={set('duration')} /></Field>
      <Field label={t('Bài tập (mỗi dòng một bài, VD: Squat 3 × 12 × 20 kg)')}>
        <Input multiline maxLength={4000} value={v.exercises} onChangeText={set('exercises')} style={{ minHeight: 100 }} />
      </Field>
      <Field label={t('Calo tiêu hao (kcal)')} hint={t('Không bắt buộc')}><Input keyboardType="number-pad" value={v.kcal} onChangeText={set('kcal')} /></Field>
      <Checkbox label={t('Đã hoàn thành')} checked={v.isDone} onChange={(isDone) => setV({ ...v, isDone })} />
      <Field label={t('Ghi chú')}><Input multiline maxLength={2000} value={v.notes} onChangeText={set('notes')} /></Field>
      <ErrorText>{error && tx(error)}</ErrorText>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onClose} />
        <Button title={save.isPending ? t('Đang lưu…') : t('Lưu')} busy={save.isPending} onPress={() => void submit()} />
      </SheetActions>
    </>
  )
}
