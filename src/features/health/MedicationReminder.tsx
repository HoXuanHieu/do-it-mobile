import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { View } from 'react-native'
import { t } from '../../i18n'
import { toDateKey, toTimeValue } from '../../lib/dates'
import { Button, Card, H2, IconButton, Input, Muted, Row, SheetActions, Sheet, TimeInput, Txt } from '../../ui/components'
import { useAuth } from '../auth/AuthContext'

// shortcut: stored on this device in AsyncStorage (per user), reminds only while the app is open (no OS notifications); move to backend + push notifications if reminders must fire in the background or reach other devices.
export interface Medication {
  id: string
  name: string
  time: string // HH:mm, local time
  takenOn?: string // YYYY-MM-DD of the last "taken" confirmation
}

const SNOOZE_MS = 10 * 60_000
const EMPTY: Medication[] = []
const listeners = new Set<() => void>()
const cache = new Map<string, Medication[]>() // userId → meds, loaded once from AsyncStorage
const keyOf = (userId: string) => `doit.meds.${userId}`
const today = () => toDateKey(new Date())
const nowHm = () => toTimeValue(new Date())
const emit = () => listeners.forEach((f) => f())
const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)

function load(userId: string) {
  if (cache.has(userId)) return
  cache.set(userId, EMPTY)
  AsyncStorage.getItem(keyOf(userId))
    .then((raw) => {
      const v: unknown = JSON.parse(raw ?? '[]')
      // a write made before the load finished wins
      if (Array.isArray(v) && cache.get(userId) === EMPTY) cache.set(userId, v as Medication[])
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

/** Meds whose time has passed today and that were not confirmed yet. */
const dueMedications = (meds: Medication[], day: string, hm: string) => meds.filter((m) => m.time <= hm && m.takenOn !== day)

/** Health page card: add / remove daily medication reminders. */
export function MedicationCard() {
  const [meds, save] = useMedications()
  const [name, setName] = useState('')
  const [time, setTime] = useState('08:00')

  const add = () => {
    if (!name.trim()) return
    // a reminder whose time already passed today starts tomorrow, so adding it does not pop up at once
    const takenOn = time <= nowHm() ? today() : undefined
    save([...meds, { id: newId(), name: name.trim(), time, takenOn }].sort((a, b) => a.time.localeCompare(b.time)))
    setName('')
  }

  return (
    <Card>
      <H2>💊 {t('Nhắc uống thuốc')}</H2>
      <Input accessibilityLabel={t('Tên thuốc')} placeholder={t('Tên thuốc')} value={name} maxLength={100} onChangeText={setName} onSubmitEditing={add} returnKeyType="done" />
      <Row>
        <View style={{ flex: 1 }}><TimeInput value={time} onChange={setTime} /></View>
        <Button title={t('Thêm')} onPress={add} disabled={!name.trim()} />
      </Row>
      {meds.length === 0 ? (
        <Muted>{t('Chưa có lời nhắc nào.')}</Muted>
      ) : (
        meds.map((m) => (
          <Row key={m.id}>
            <Txt style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '700' }}>{m.time}</Txt> {m.name}
              {m.takenOn === today() && <Muted> · ✓ {t('Đã uống hôm nay')}</Muted>}
            </Txt>
            <IconButton label={t('Xóa')} onPress={() => save(meds.filter((x) => x.id !== m.id))}>×</IconButton>
          </Row>
        ))
      )}
    </Card>
  )
}

/** Mounted in the app shell: pops up when a medication is due; closing snoozes it for 10 minutes. */
export function MedicationReminderPopup() {
  const [meds, save] = useMedications()
  const [now, setNow] = useState(() => new Date())
  const [snoozedUntil, setSnoozedUntil] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000) // re-evaluate the clock every 30 s
    return () => clearInterval(id)
  }, [])

  const day = toDateKey(now)
  const due = now.getTime() < snoozedUntil ? [] : dueMedications(meds, day, toTimeValue(now))

  const snooze = () => setSnoozedUntil(Date.now() + SNOOZE_MS)

  const markTaken = () => {
    const ids = new Set(due.map((m) => m.id))
    save(meds.map((m) => (ids.has(m.id) ? { ...m, takenOn: day } : m)))
  }

  return (
    <Sheet open={due.length > 0} title={t('Đến giờ uống thuốc')} onClose={snooze}>
      {due.map((m) => (
        <Txt key={m.id}>
          <Txt style={{ fontWeight: '700' }}>{m.time}</Txt> 💊 {m.name}
        </Txt>
      ))}
      <SheetActions>
        <Button variant="ghost" title={t('Nhắc lại sau 10 phút')} onPress={snooze} />
        <Button title={t('Đã uống')} onPress={markTaken} />
      </SheetActions>
    </Sheet>
  )
}
