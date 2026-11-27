import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { t, type Key } from '../../i18n'
import { addDays, DAY_MS, formatDate, parseDateKey, toDateKey, toTimeValue } from '../../lib/dates'
import { Button, Card, ConfirmDialog, Field, H2, IconButton, Input, Muted, Row, RowBetween, Select, Sheet, SheetActions, Txt } from '../../ui/components'
import { DateInput } from '../../ui/DatePicker'
import { TimeInput } from '../../ui/TimePicker'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import { useAuth } from '../auth/AuthContext'
import { Checkbox } from './parts'

// shortcut: stored on this device in AsyncStorage (per user), reminds only while the app is open (no OS notifications); move to backend + push notifications if reminders must fire in the background or reach other devices.
// Same shape as the web app's MedicationReminder.
export type MealTiming = 'before' | 'after' | 'with' | 'any'
export type DoseStatus = 'taken' | 'missed'
export interface Medication {
  id: string
  name: string
  amount: number // how much per dose, in `unit`
  unit: Key // one of UNITS
  timing: MealTiming
  times: string[] // HH:mm, local time, sorted; one med, several doses a day
  note?: string
  start: string // YYYY-MM-DD, first day of the course
  end?: string // YYYY-MM-DD, last day of the course; none = ongoing
  log: Record<string, DoseStatus> // "YYYY-MM-DD HH:mm" → what happened to that dose
  createdAt: string // "YYYY-MM-DD HH:mm": doses before it are not counted in the stats
  from?: string // "YYYY-MM-DD HH:mm" of the last save: doses before it never pop up
}

const MEAL_TIMINGS: { value: MealTiming; label: Key }[] = [
  { value: 'after', label: 'Sau ăn' },
  { value: 'before', label: 'Trước ăn' },
  { value: 'with', label: 'Trong bữa ăn' },
  { value: 'any', label: 'Không phụ thuộc bữa ăn' },
]
const UNITS: Key[] = ['viên', 'viên nang', 'gói', 'ml', 'mg', 'giọt', 'ống', 'lần xịt']
const timingLabel = (v: MealTiming) => t(MEAL_TIMINGS.find((x) => x.value === v)?.label ?? 'Không phụ thuộc bữa ăn')
const subtitle = (m: Medication) => `${m.amount} ${t(m.unit)} · ${timingLabel(m.timing)}`

const SNOOZE_MS = 10 * 60_000
const DOSE_ROW_H = 46 // one DoseRow: 28 checkbox row + 2×6 padding + borders, rounded up
const EMPTY: Medication[] = []
const listeners = new Set<() => void>()
const cache = new Map<string, Medication[]>() // userId → meds, loaded once from AsyncStorage
const keyOf = (userId: string) => `doit.meds.${userId}`
const today = () => toDateKey(new Date())
const nowStamp = () => `${today()} ${toTimeValue(new Date())}`
const daysBetween = (a: string, b: string) => Math.round((parseDateKey(b)!.getTime() - parseDateKey(a)!.getTime()) / DAY_MS)
const emit = () => listeners.forEach((f) => f())
const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)

/** Reads the current shape and the older ones (free-text `dose`, `taken` per time, one-time `{ time, takenOn }`). */
type Stored = Partial<Medication> & { dose?: string; taken?: Record<string, string>; time?: string; takenOn?: string }
function normalize(m: Stored): Medication {
  const [, num, rest] = (m.dose ?? '').match(/^\s*([\d.,]+)\s*(.*)$/) ?? []
  const taken = m.taken ?? (m.time && m.takenOn ? { [m.time]: m.takenOn } : {})
  return {
    id: m.id ?? newId(),
    name: m.name ?? '',
    amount: m.amount ?? (Number(num?.replace(',', '.')) || 1),
    unit: m.unit ?? (UNITS.find((u) => u === rest?.trim().toLowerCase()) ?? 'viên'),
    timing: m.timing ?? 'any',
    times: m.times ?? (m.time ? [m.time] : []),
    note: m.note,
    start: m.start ?? m.from?.slice(0, 10) ?? today(),
    end: m.end,
    log: m.log ?? Object.fromEntries(Object.entries(taken).map(([time, day]) => [`${day} ${time}`, 'taken' as const])),
    createdAt: m.createdAt ?? m.from ?? `${today()} 00:00`,
    from: m.from,
  }
}

function load(userId: string) {
  if (cache.has(userId)) return
  cache.set(userId, EMPTY)
  AsyncStorage.getItem(keyOf(userId))
    .then((raw) => {
      const v: unknown = JSON.parse(raw ?? '[]')
      // a write made before the load finished wins
      if (Array.isArray(v) && cache.get(userId) === EMPTY) cache.set(userId, (v as Stored[]).map(normalize))
    })
    .catch(() => {}) // corrupted or unreadable value: start fresh
    .finally(emit)
}

function write(userId: string, meds: Medication[]) {
  cache.set(userId, meds)
  emit()
  AsyncStorage.setItem(keyOf(userId), JSON.stringify(meds)).catch(() => {})
}

function subscribe(f: () => void) {
  listeners.add(f)
  return () => void listeners.delete(f)
}

function useMedications() {
  const userId = useAuth().user?.id ?? 'anon'
  useEffect(() => load(userId), [userId])
  const meds = useSyncExternalStore(subscribe, () => cache.get(userId) ?? EMPTY)
  return [meds, (next: Medication[]) => write(userId, next)] as const
}

const activeOn = (m: Medication, day: string) => m.start <= day && (!m.end || day <= m.end)

/** Doses whose time has passed today, inside the course, and not marked taken or missed yet. */
const dueDoses = (meds: Medication[], day: string, hm: string) =>
  meds.flatMap((m) =>
    activeOn(m, day)
      ? m.times.filter((x) => x <= hm && !m.log[`${day} ${x}`] && !(m.from && `${day} ${x}` < m.from)).map((time) => ({ med: m, time }))
      : [],
  )

/** Doses scheduled so far in the course (up to `now` or the end date) and how many of them were taken. */
function courseStats(m: Medication, now: string) {
  let due = 0
  let taken = 0
  const last = m.end && m.end < now.slice(0, 10) ? m.end : now.slice(0, 10)
  for (let d = parseDateKey(m.start)!, day = m.start; day <= last; d = addDays(d, 1), day = toDateKey(d)) {
    for (const x of m.times) {
      const k = `${day} ${x}`
      if (k < m.createdAt || k > now) continue
      due++
      if (m.log[k] === 'taken') taken++
    }
  }
  return { due, taken, missed: due - taken }
}

const firstTime = (m: Medication) => m.times[0] ?? '99:99'

/** One dose with its two checkboxes: taken / forgot. Unticking both clears the dose. */
function DoseRow({ time, status, onChange, children }: { time: string; status?: DoseStatus | null; onChange: (s: DoseStatus | null) => void; children?: ReactNode }) {
  const c = useColors()
  const color = status === 'taken' ? c.primary : status === 'missed' ? c.danger : c.text
  return (
    <View style={{ gap: 2, minHeight: children ? undefined : DOSE_ROW_H, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8, borderColor: status ? color : c.border }}>
      {children}
      <Row style={{ flexWrap: 'wrap', gap: 14 }}>
        <Txt style={{ fontWeight: '700', color, minWidth: 44, textDecorationLine: status === 'taken' ? 'line-through' : 'none' }}>{time}</Txt>
        <Checkbox label={t('Đã uống')} a11yLabel={`${time} ${t('Đã uống')}`} checked={status === 'taken'} onChange={(on) => onChange(on ? 'taken' : null)} />
        <Checkbox label={t('Quên uống')} a11yLabel={`${time} ${t('Quên uống')}`} checked={status === 'missed'} onChange={(on) => onChange(on ? 'missed' : null)} />
      </Row>
    </View>
  )
}

/** Health "Nhắc uống thuốc" tab: one card per medication with today's doses, course progress, stats and extend. */
export function MedicationTab() {
  const [meds, save] = useMedications()
  const [editing, setEditing] = useState<Medication | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Medication | null>(null)
  const [extending, setExtending] = useState<Medication | null>(null)
  const c = useColors()
  const pattern = usePreferences().data?.dateFormat
  const fmt = (key: string) => formatDate(parseDateKey(key)!, pattern)
  const day = today()
  const now = nowStamp()

  const setStatus = (m: Medication, time: string, s: DoseStatus | null) => {
    const log = { ...m.log }
    if (s) log[`${day} ${time}`] = s
    else delete log[`${day} ${time}`]
    save(meds.map((x) => (x.id === m.id ? { ...x, log } : x)))
  }

  const upsert = (m: Medication) => {
    const next = meds.some((x) => x.id === m.id) ? meds.map((x) => (x.id === m.id ? m : x)) : [...meds, m]
    save(next.sort((a, b) => firstTime(a).localeCompare(firstTime(b))))
    setEditing(null)
    setExtending(null)
  }

  const todays = meds.filter((m) => activeOn(m, day))
  const doses = todays.reduce((n, m) => n + m.times.length, 0)
  const done = todays.reduce((n, m) => n + m.times.filter((x) => m.log[`${day} ${x}`] === 'taken').length, 0)

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <RowBetween>
          <View style={{ flex: 1 }}>
            <H2>💊 {t('Nhắc uống thuốc')}</H2>
            {doses > 0 && <Muted>{t('Hôm nay: {done}/{total} liều', { done, total: doses })}</Muted>}
          </View>
          <Button small title={t('+ Thêm thuốc')} onPress={() => setEditing('new')} />
        </RowBetween>
        {meds.length === 0 && <Muted>{t('Chưa có lời nhắc nào.')}</Muted>}
      </Card>

      {meds.map((m) => {
        const s = courseStats(m, now)
        const ended = !!m.end && m.end < day
        const active = activeOn(m, day)
        return (
          <Card key={m.id} style={ended ? { borderStyle: 'dashed' } : undefined}>
            <RowBetween>
              <Txt style={{ flex: 1, fontWeight: '700', fontSize: 16 }}>💊 {m.name}</Txt>
              <Button small variant="ghost" title={t('Sửa')} onPress={() => setEditing(m)} />
              <IconButton label={t('Xóa')} onPress={() => setDeleting(m)}>×</IconButton>
            </RowBetween>
            <View style={{ gap: 2 }}>
              <Muted style={{ fontSize: 13 }}>{subtitle(m)}</Muted>
              <Muted style={{ fontSize: 13 }}>
                📅 {fmt(m.start)} → {m.end ? fmt(m.end) : t('Không thời hạn')}
                {m.end && active ? ` · ${t('Ngày {day}/{total}', { day: daysBetween(m.start, day) + 1, total: daysBetween(m.start, m.end) + 1 })}` : ''}
                {m.start > day ? ` · ${t('Chưa bắt đầu')}` : ''}
              </Muted>
              {m.note ? <Muted style={{ fontSize: 13 }}>{m.note}</Muted> : null}
            </View>
            {active && (
              // at most 3 doses visible; more scroll inside the card
              <ScrollView nestedScrollEnabled style={{ maxHeight: 3 * DOSE_ROW_H + 2 * 8 }} contentContainerStyle={{ gap: 8 }}>
                {m.times.map((time) => (
                  <DoseRow key={time} time={time} status={m.log[`${day} ${time}`]} onChange={(st) => setStatus(m, time, st)} />
                ))}
              </ScrollView>
            )}
            {s.due > 0 && (
              <Txt style={{ fontSize: 14 }}>
                {t('Đã uống {taken}/{due} liều', { taken: s.taken, due: s.due })}
                {s.missed > 0 && <Txt style={{ fontSize: 14, color: c.danger }}> · {t('Thiếu {n} liều', { n: s.missed })}</Txt>}
              </Txt>
            )}
            {ended && (
              <RowBetween style={{ paddingTop: 8, borderTopWidth: 1, borderColor: c.border }}>
                <Txt style={{ flex: 1 }}>✅ {t('Đã hết liệu trình')}</Txt>
                <Button small title={t('Gia hạn')} onPress={() => setExtending(m)} />
              </RowBetween>
            )}
          </Card>
        )
      })}

      <Sheet open={editing != null} title={editing === 'new' ? t('Thêm thuốc') : t('Sửa thuốc')} onClose={() => setEditing(null)}>
        {editing && <MedicationForm med={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={upsert} />}
      </Sheet>
      <Sheet open={extending != null} title={t('Gia hạn {name}', { name: extending?.name ?? '' })} onClose={() => setExtending(null)}>
        {extending && <ExtendForm med={extending} onCancel={() => setExtending(null)} onSave={upsert} />}
      </Sheet>
      <ConfirmDialog
        open={deleting != null}
        title={t('Xóa thuốc')}
        message={t('Xóa "{name}" và tất cả lời nhắc của thuốc này?', { name: deleting?.name ?? '' })}
        confirmLabel={t('Xóa')}
        onConfirm={() => {
          save(meds.filter((x) => x.id !== deleting?.id))
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </View>
  )
}

/** Adds days after the end of the course; defaults to enough days to make up the missed doses. */
function ExtendForm({ med, onCancel, onSave }: { med: Medication; onCancel: () => void; onSave: (m: Medication) => void }) {
  const missed = courseStats(med, nowStamp()).missed
  const [days, setDays] = useState(String(Math.max(1, Math.ceil(missed / Math.max(1, med.times.length)))))
  const n = Math.floor(Number(days))
  const ok = n > 0 && n <= 365
  // shortcut: when the course ended before yesterday, the days in between count as missed in the stats; track gaps if that matters.
  const base = med.end! < today() ? toDateKey(addDays(parseDateKey(today())!, -1)) : med.end!

  return (
    <>
      {missed > 0 && <Muted>{t('Thiếu {n} liều', { n: missed })}</Muted>}
      <Field label={t('Gia hạn thêm (ngày)')}>
        <Input autoFocus keyboardType="number-pad" maxLength={3} value={days} onChangeText={setDays} invalid={!ok} />
      </Field>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onCancel} />
        <Button title={t('Gia hạn')} disabled={!ok} onPress={() => ok && onSave({ ...med, end: toDateKey(addDays(parseDateKey(base)!, n)), from: nowStamp() })} />
      </SheetActions>
    </>
  )
}

function MedicationForm({ med, onCancel, onSave }: { med?: Medication; onCancel: () => void; onSave: (m: Medication) => void }) {
  const [name, setName] = useState(med?.name ?? '')
  const [amount, setAmount] = useState(med ? String(med.amount) : '1')
  const [unit, setUnit] = useState<Key>(med?.unit ?? 'viên')
  const [timing, setTiming] = useState<MealTiming>(med?.timing ?? 'after')
  const [times, setTimes] = useState<string[]>(med?.times.length ? med.times : ['08:00'])
  const [start, setStart] = useState(med?.start ?? today())
  const [end, setEnd] = useState(() => med?.end ?? toDateKey(addDays(parseDateKey(today())!, 6)))
  const [note, setNote] = useState(med?.note ?? '')
  const pattern = usePreferences().data?.dateFormat
  const unique = [...new Set(times)].sort()
  const qty = Number(amount.replace(',', '.'))
  const qtyOk = Number.isFinite(qty) && qty > 0 && qty <= 10000
  const datesOk = !!start && (!end || end >= start)

  const submit = () => {
    if (!name.trim() || unique.length === 0 || !qtyOk || !datesOk) return
    // doses already past at save time do not pop up (they can still be ticked by hand)
    const from = nowStamp()
    onSave({
      id: med?.id ?? newId(),
      name: name.trim(),
      amount: qty,
      unit,
      timing,
      times: unique,
      note: note.trim() || undefined,
      start,
      end: end || undefined,
      log: med?.log ?? {},
      createdAt: med?.createdAt ?? from,
      from,
    })
  }

  return (
    <>
      <Field label={t('Tên thuốc')}>
        <Input autoFocus maxLength={100} placeholder={t('VD: Vitamin C')} value={name} onChangeText={setName} />
      </Field>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('Liều lượng')} error={qtyOk ? undefined : t('Liều lượng phải lớn hơn 0.')}>
            <Input keyboardType="decimal-pad" maxLength={8} value={amount} onChangeText={setAmount} invalid={!qtyOk} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('Đơn vị')}>
            <Select label={t('Đơn vị')} value={unit} onChange={setUnit} options={UNITS.map((u) => ({ value: u, label: t(u) }))} />
          </Field>
        </View>
      </Row>
      <Field label={t('Ngày bắt đầu')}>
        <DateInput value={start} onChange={setStart} pattern={pattern} />
      </Field>
      <Field label={t('Ngày kết thúc')} hint={t('Để trống nếu dùng lâu dài')} error={datesOk ? undefined : t('Ngày kết thúc phải sau ngày bắt đầu.')}>
        <DateInput value={end} onChange={setEnd} pattern={pattern} minimumDate={parseDateKey(start) ?? undefined} optional invalid={!datesOk} />
      </Field>
      <Field label={t('Thời điểm uống')}>
        <Select label={t('Thời điểm uống')} value={timing} onChange={setTiming} options={MEAL_TIMINGS.map((x) => ({ value: x.value, label: t(x.label) }))} />
      </Field>
      <Field label={t('Giờ nhắc trong ngày')} hint={unique.length < times.length ? t('Giờ trùng nhau sẽ được gộp lại.') : undefined}>
        <View style={{ gap: 8 }}>
          {times.map((x, i) => (
            <Row key={i}>
              <View style={{ flex: 1 }}>
                <TimeInput value={x} onChange={(v) => setTimes(times.map((y, j) => (j === i ? v : y)))} />
              </View>
              {times.length > 1 && <IconButton label={t('Xóa')} onPress={() => setTimes(times.filter((_, j) => j !== i))}>×</IconButton>}
            </Row>
          ))}
          {times.length < 8 && <Button small variant="ghost" title={t('+ Thêm giờ')} onPress={() => setTimes([...times, '12:00'])} />}
        </View>
      </Field>
      <Field label={t('Ghi chú')}>
        <Input multiline maxLength={500} placeholder={t('VD: uống với nhiều nước')} value={note} onChangeText={setNote} />
      </Field>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onCancel} />
        <Button title={t('Lưu')} onPress={submit} disabled={!name.trim() || !qtyOk || !datesOk} />
      </SheetActions>
    </>
  )
}

/** Mounted in the app shell: pops up when doses are due; mark each taken or forgotten. Closing snoozes for 10 minutes. */
export function MedicationReminderPopup() {
  const [meds, save] = useMedications()
  const [now, setNow] = useState(() => new Date())
  const [snoozedUntil, setSnoozedUntil] = useState(0)
  const [choice, setChoice] = useState<Record<string, DoseStatus | null>>({}) // rows changed in the popup; default is taken

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000) // re-evaluate the clock every 30 s
    return () => clearInterval(id)
  }, [])

  const day = toDateKey(now)
  const due = now.getTime() < snoozedUntil ? [] : dueDoses(meds, day, toTimeValue(now))
  const keyOfDose = (d: { med: Medication; time: string }) => `${d.med.id}@${d.time}`
  const statusOf = (d: { med: Medication; time: string }) => { const k = keyOfDose(d); return k in choice ? choice[k] : 'taken' }

  const snooze = () => {
    setSnoozedUntil(Date.now() + SNOOZE_MS)
    setChoice({})
  }

  const confirm = () => {
    const picked = due.filter((d) => statusOf(d))
    save(meds.map((m) => {
      const mine = picked.filter((d) => d.med.id === m.id)
      return mine.length ? { ...m, log: { ...m.log, ...Object.fromEntries(mine.map((d) => [`${day} ${d.time}`, statusOf(d)!])) } } : m
    }))
    if (picked.length < due.length) snooze() // the unticked ones come back in 10 minutes
    else setChoice({})
  }

  return (
    <Sheet open={due.length > 0} title={t('Đến giờ uống thuốc')} onClose={snooze}>
      {due.map((d) => (
        <DoseRow key={keyOfDose(d)} time={d.time} status={statusOf(d)} onChange={(s) => setChoice((c) => ({ ...c, [keyOfDose(d)]: s }))}>
          <Txt>💊 {d.med.name} <Muted>· {subtitle(d.med)}</Muted></Txt>
        </DoseRow>
      ))}
      <SheetActions>
        <Button variant="ghost" title={t('Nhắc lại sau 10 phút')} onPress={snooze} />
        <Button title={t('Xác nhận')} onPress={confirm} />
      </SheetActions>
    </Sheet>
  )
}
