import { useRef, type ComponentRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { t } from '../../i18n'
import { addDays, formatTime, isSameDay, overlapsDay, startOfMonth, startOfWeek, weekdayName } from '../../lib/dates'
import { CATEGORY_COLOR, useColors } from '../../ui/theme'
import type { EventSummaryDto } from './api'
import { eventsOnDay, layoutDay } from './layout'

export type CalendarView = 'month' | 'week' | 'day'

interface ViewProps {
  date: Date
  today: Date
  events: EventSummaryDto[]
  onOpenEvent: (id: string) => void
  onCreateAt: (start: Date, allDay: boolean) => void
  onOpenDay: (day: Date) => void
}

const hair = StyleSheet.hairlineWidth

/** web .chip: category-tinted pill; completed = ✓ + faded, cancelled = struck through + faded. */
function EventChip({ e, onOpen, time = true, small }: { e: EventSummaryDto; onOpen: (id: string) => void; time?: boolean; small?: boolean }) {
  const c = useColors()
  const color = CATEGORY_COLOR[e.category]
  const fs = small ? 10 : 12
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={e.title}
      onPress={() => onOpen(e.id)}
      style={{ flexDirection: 'row', gap: 3, borderLeftWidth: 3, borderLeftColor: color, backgroundColor: color + '29', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, opacity: e.status === 'Completed' ? 0.6 : e.status === 'Cancelled' ? 0.5 : 1 }}
    >
      {time && !e.isAllDay && <Text style={{ fontSize: fs, color: c.muted }}>{formatTime(new Date(e.startAt))}</Text>}
      <ChipTitle e={e} style={{ fontSize: fs, flex: 1 }} numberOfLines={1} />
    </Pressable>
  )
}

function ChipTitle({ e, style, numberOfLines }: { e: EventSummaryDto; style?: object; numberOfLines?: number }) {
  const c = useColors()
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: c.text, fontWeight: '500', textDecorationLine: e.status === 'Cancelled' ? 'line-through' : 'none' }, style]}>
      {e.status === 'Completed' ? '✓ ' : ''}
      {e.title}
    </Text>
  )
}

const MAX_CHIPS = 3

/**
 * FR-TM-001 monthly view: 6 weeks × 7 days, Monday first.
 * Mobile: tapping a cell opens that day (cells are too small to read every chip); long-press creates an event at 09:00.
 */
export function MonthView({ date, today, events, onOpenEvent, onCreateAt, onOpenDay }: ViewProps) {
  const c = useColors()
  const first = startOfWeek(startOfMonth(date))
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7))

  return (
    <ScrollView accessibilityLabel={t('Lịch tháng')}>
      <View style={{ flexDirection: 'row', borderBottomWidth: hair, borderColor: c.border }}>
        {days.slice(0, 7).map((d) => (
          <Text key={d.toISOString()} style={{ flex: 1, textAlign: 'center', paddingVertical: 6, fontSize: 12, fontWeight: '600', color: c.muted }}>
            {weekdayName(d)}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].toISOString()} style={{ flexDirection: 'row' }}>
          {week.map((d, i) => {
            const dayEvents = eventsOnDay(events, d)
            const outside = d.getMonth() !== date.getMonth()
            const isToday = isSameDay(d, today)
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={t('Xem ngày {d}/{m}', { d: d.getDate(), m: d.getMonth() + 1 })}
                onPress={() => onOpenDay(d)}
                onLongPress={() => onCreateAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9), false)}
                style={{ flex: 1, minWidth: 0, minHeight: 92, padding: 2, gap: 2, borderBottomWidth: hair, borderRightWidth: i < 6 ? hair : 0, borderColor: c.border, backgroundColor: outside ? c.bg : c.surface }}
              >
                <View style={{ alignSelf: 'center', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? c.primary : 'transparent' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isToday ? '#fff' : outside ? c.muted : c.text }}>{d.getDate()}</Text>
                </View>
                {dayEvents.slice(0, MAX_CHIPS).map((e) => (
                  <EventChip key={e.id} e={e} onOpen={onOpenEvent} time={false} small />
                ))}
                {dayEvents.length > MAX_CHIPS && (
                  <Text onPress={() => onOpenDay(d)} style={{ fontSize: 10, color: c.muted }}>
                    {t('+{n} nữa', { n: dayEvents.length - MAX_CHIPS })}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </ScrollView>
  )
}

const HOUR_PX = 48
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const GUTTER = 42

/** FR-TM-001 weekly (7 narrow columns) and daily (1 column) time grid. */
export function TimeGridView({ date, today, events, onOpenEvent, onCreateAt, onOpenDay, days: dayCount }: ViewProps & { days: 1 | 7 }) {
  const c = useColors()
  const first = dayCount === 7 ? startOfWeek(date) : date
  const days = Array.from({ length: dayCount }, (_, i) => addDays(first, i))
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)
  const scrolled = useRef(false)
  const nowMinutes = today.getHours() * 60 + today.getMinutes()
  const narrow = dayCount === 7

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: hair, borderColor: c.border }}>
        <View style={{ width: GUTTER }} />
        {days.map((d) => {
          const isToday = isSameDay(d, today)
          return (
            <Pressable key={d.toISOString()} disabled={dayCount === 1} onPress={() => onOpenDay(d)} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: c.text }}>{weekdayName(d, dayCount === 1 ? 'long' : 'short')}</Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? c.primary : 'transparent' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: isToday ? '#fff' : c.text }}>{d.getDate()}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: hair, borderColor: c.border }}>
        <Text style={{ width: GUTTER, fontSize: 10, color: c.muted, textAlign: 'right', paddingRight: 4, alignSelf: 'center' }}>{t('Cả ngày')}</Text>
        {days.map((d) => (
          <Pressable
            key={d.toISOString()}
            accessibilityRole="button"
            accessibilityLabel={t('Cả ngày')}
            onPress={() => onCreateAt(new Date(d.getFullYear(), d.getMonth(), d.getDate()), true)}
            style={{ flex: 1, minWidth: 0, minHeight: 28, padding: 2, gap: 2, borderLeftWidth: hair, borderColor: c.border }}
          >
            {events
              .filter((e) => e.isAllDay && overlapsDay(new Date(e.startAt), new Date(e.endAt), d))
              .map((e) => (
                <EventChip key={e.id} e={e} onOpen={onOpenEvent} small={narrow} />
              ))}
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        onLayout={() => {
          // Start scrolled to 07:00 like most calendar apps.
          if (scrolled.current) return
          scrolled.current = true
          scroller.current?.scrollTo({ y: 7 * HOUR_PX, animated: false })
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: GUTTER }}>
            {HOURS.map((h) => (
              <Text key={h} style={{ height: HOUR_PX, fontSize: 10, color: c.muted, textAlign: 'right', paddingRight: 4, marginTop: h === 0 ? 0 : -6 }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </Text>
            ))}
          </View>
          {days.map((d) => (
            <View key={d.toISOString()} style={{ flex: 1, minWidth: 0, borderLeftWidth: hair, borderColor: c.border }}>
              {HOURS.map((h) => (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  accessibilityLabel={t('Tạo sự kiện lúc {h}:00', { h })}
                  onPress={() => onCreateAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h), false)}
                  style={{ height: HOUR_PX, borderBottomWidth: hair, borderColor: c.border }}
                />
              ))}
              {layoutDay(events, d).map((p) => (
                <Pressable
                  key={p.event.id}
                  accessibilityRole="button"
                  accessibilityLabel={p.event.title}
                  onPress={() => onOpenEvent(p.event.id)}
                  style={{
                    position: 'absolute',
                    top: (p.top / 60) * HOUR_PX,
                    height: Math.max((p.height / 60) * HOUR_PX - 2, 18),
                    left: `${(p.col / p.cols) * 100}%`,
                    width: `${100 / p.cols}%`,
                    padding: 1,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      borderRadius: 4,
                      borderLeftWidth: 3,
                      borderLeftColor: CATEGORY_COLOR[p.event.category],
                      backgroundColor: c.surface,
                      opacity: p.event.status === 'Completed' ? 0.6 : p.event.status === 'Cancelled' ? 0.5 : 1,
                    }}
                  >
                    <View style={{ flex: 1, paddingHorizontal: 2, backgroundColor: CATEGORY_COLOR[p.event.category] + '29' }}>
                      <ChipTitle e={p.event} style={{ fontSize: narrow ? 10 : 12 }} />
                      <Text style={{ fontSize: narrow ? 9 : 11, color: c.muted }}>
                        {p.continuesBefore ? '…' : formatTime(new Date(p.event.startAt))} – {p.continuesAfter ? '…' : formatTime(new Date(p.event.endAt))}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              {isSameDay(d, today) && (
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (nowMinutes / 60) * HOUR_PX, height: 2, backgroundColor: c.danger, zIndex: 2 }}>
                  <View style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger }} />
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
