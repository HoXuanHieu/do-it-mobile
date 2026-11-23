import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { t, type Key } from '../../i18n'
import { addDays, addMonths, formatDate, monthTitle, parseDateKey, startOfDay, startOfMonth, startOfWeek, toDateKey } from '../../lib/dates'
import { Button, ErrorText, Fab, H2, IconButton, Input, LinkText, Row, Screen, Segmented, Select, Sheet } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { EventCategory, EventDetailDto, EventFilters, EventStatus } from './api'
import { MonthView, TimeGridView, type CalendarView } from './CalendarViews'
import { EventDetailDialog } from './EventDetailDialog'
import { EventFormDialog, eventFormTitle, type EventFormMode } from './EventFormDialog'
import { CATEGORIES, STATUSES } from './meta'
import { useEventDetail, useEventsInRange } from './queries'

const VIEWS: { value: CalendarView; label: Key }[] = [
  { value: 'month', label: 'Tháng' },
  { value: 'week', label: 'Tuần' },
  { value: 'day', label: 'Ngày|view' },
]

function rangeFor(view: CalendarView, date: Date) {
  if (view === 'month') {
    const from = startOfWeek(startOfMonth(date))
    return { from, to: addDays(from, 42) }
  }
  if (view === 'week') {
    const from = startOfWeek(date)
    return { from, to: addDays(from, 7) }
  }
  const from = startOfDay(date)
  return { from, to: addDays(from, 1) }
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

/** Time Management module (SRS §4.3). Params: view=month|week|day, date=YYYY-MM-DD, event=<id> */
export function CalendarPage() {
  const c = useColors()
  const params = useLocalSearchParams<{ view?: string; date?: string; event?: string }>()
  const now = useNow()
  const dateFormat = usePreferences().data?.dateFormat

  const rawView = one(params.view)
  const view = (VIEWS.some((v) => v.value === rawView) ? rawView : 'month') as CalendarView
  const paramDate = one(params.date)
  const dateKey = paramDate ?? toDateKey(now)
  const date = useMemo(() => parseDateKey(dateKey) ?? startOfDay(now), [dateKey, now])
  const openEventId = one(params.event) ?? null

  const [category, setCategory] = useState<EventCategory | ''>('')
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 300)
  const filters: EventFilters = { category: category || undefined, status: status || undefined, q: q || undefined }

  const { from, to } = useMemo(() => rangeFor(view, date), [view, date])
  const events = useEventsInRange(from, to, filters)

  const [form, setForm] = useState<EventFormMode | null>(null)

  // undefined removes the param
  const update = (patch: { view?: string; date?: string; event?: string | null }) =>
    router.setParams(Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? undefined])))

  // Deep link from a reminder notification (?event=id): jump to the event's day.
  const deepLinked = useEventDetail(openEventId && !paramDate ? openEventId : null)
  useEffect(() => {
    if (deepLinked.data && !paramDate) router.setParams({ date: toDateKey(new Date(deepLinked.data.startAt)) })
  }, [deepLinked.data, paramDate])

  const step = (dir: 1 | -1) => {
    const next = view === 'month' ? addMonths(date, dir) : addDays(date, dir * (view === 'week' ? 7 : 1))
    update({ date: toDateKey(next) })
  }

  const title =
    view === 'month'
      ? monthTitle(date)
      : view === 'week'
        ? `${formatDate(from, dateFormat)} – ${formatDate(addDays(to, -1), dateFormat)}`
        : formatDate(date, dateFormat)

  const viewProps = {
    date,
    today: now,
    events: events.data ?? [],
    onOpenEvent: (id: string) => update({ event: id }),
    onCreateAt: (start: Date, allDay: boolean) => setForm({ kind: 'create', start, allDay }),
    onOpenDay: (day: Date) => update({ view: 'day', date: toDateKey(day) }),
  }

  const onSaved = (saved: EventDetailDto) => {
    setForm(null)
    update({ event: saved.id, date: toDateKey(new Date(saved.startAt)) })
  }

  const filtered = !!(category || status || q)

  // One sheet hosts both detail and form (closing the form returns to the detail when an event is open, like web).
  const detail = useEventDetail(form ? null : openEventId)
  const sheetTitle = form ? eventFormTitle(form) : (detail.data?.title ?? t('Sự kiện'))
  const closeSheet = () => (form ? setForm(null) : update({ event: null }))

  return (
    <Screen scroll={false} style={{ padding: 12, gap: 8 }}>
      <Row>
        <Button small variant="outline" title={t('Hôm nay')} onPress={() => update({ date: toDateKey(new Date()) })} />
        <IconButton label={t('Trước')} onPress={() => step(-1)}>‹</IconButton>
        <IconButton label={t('Sau')} onPress={() => step(1)}>›</IconButton>
        <H2 style={{ flex: 1 }} numberOfLines={1}>{title}</H2>
        {events.isFetching && <ActivityIndicator accessibilityLabel={t('Đang tải…')} />}
      </Row>
      <Segmented value={view} onChange={(v) => update({ view: v })} options={VIEWS.map((v) => ({ value: v.value, label: t(v.label) }))} />

      {/* FR-TM-011 */}
      <Input
        placeholder={t('Tìm theo tiêu đề, mô tả, địa điểm…')}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel={t('Tìm kiếm sự kiện')}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{ paddingVertical: 8 }}
      />
      <Row>
        <View style={{ flex: 1 }}>
          <Select
            label={t('Phân loại')}
            value={category}
            onChange={setCategory}
            options={[{ value: '' as const, label: t('Tất cả phân loại') }, ...CATEGORIES.map((x) => ({ value: x.value, label: t(x.label) }))]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            label={t('Trạng thái')}
            value={status}
            onChange={setStatus}
            options={[{ value: '' as const, label: t('Tất cả trạng thái') }, ...STATUSES.map((x) => ({ value: x.value, label: t(x.label) }))]}
          />
        </View>
      </Row>
      {filtered && (
        <LinkText
          style={{ alignSelf: 'flex-start' }}
          onPress={() => {
            setCategory('')
            setStatus('')
            setSearch('')
          }}
        >
          {t('Xóa bộ lọc')}
        </LinkText>
      )}

      {events.isError && <ErrorText>{t('Không tải được sự kiện.')}</ErrorText>}

      <View style={{ flex: 1, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 10, overflow: 'hidden' }}>
        {view === 'month' && <MonthView {...viewProps} />}
        {view === 'week' && <TimeGridView key="week" {...viewProps} days={7} />}
        {view === 'day' && <TimeGridView key="day" {...viewProps} days={1} />}
      </View>

      <Fab
        label={t('Tạo sự kiện')}
        onPress={() => {
          const base = new Date()
          const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), base.getHours() + 1)
          setForm({ kind: 'create', start, allDay: false })
        }}
      />

      <Sheet open={!!form || !!openEventId} title={sheetTitle} onClose={closeSheet}>
        {form ? (
          <EventFormDialog key={form.kind === 'edit' ? form.event.id : form.start.toISOString()} mode={form} onClose={() => setForm(null)} onSaved={onSaved} />
        ) : openEventId ? (
          <EventDetailDialog eventId={openEventId} onClose={() => update({ event: null })} onEdit={(event) => setForm({ kind: 'edit', event })} />
        ) : null}
      </Sheet>
    </Screen>
  )
}
