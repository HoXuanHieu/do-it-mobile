import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { locale, t } from '../i18n'
import { addDays, addMonths, formatDate, isSameDay, parseDateKey, startOfMonth, startOfWeek, toDateKey } from '../lib/dates'
import { Button, Sheet } from './components'
import { useColors } from './theme'

// Same picker as the web DateInput: field "📅 27/09/2021 ▾" → month grid (Monday first); tap the title to pick a year.
// Value is "YYYY-MM-DD" or ''.
const Arrow = ({ d, color }: { d: string; color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
    <Path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

export function DateInput({
  value,
  onChange,
  pattern,
  minimumDate,
  maximumDate,
  placeholder,
  invalid,
  optional,
}: {
  value: string
  onChange: (v: string) => void
  /** Display pattern from preferences (dd/MM/yyyy …). */
  pattern?: string
  minimumDate?: Date
  maximumDate?: Date
  placeholder?: string
  invalid?: boolean
  optional?: boolean
}) {
  const c = useColors()
  const selected = parseDateKey(value)
  const [open, setOpen] = useState(false)
  const [yearMode, setYearMode] = useState(false)
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()))
  const today = new Date()
  const min = minimumDate ? toDateKey(minimumDate) : undefined
  const max = maximumDate ? toDateKey(maximumDate) : undefined
  const outOfRange = (key: string) => (!!min && key < min) || (!!max && key > max)

  const first = startOfWeek(view)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const weekdays = days.slice(0, 7).map((d) => d.toLocaleDateString(locale(), { weekday: 'narrow' }))
  const minYear = minimumDate?.getFullYear() ?? today.getFullYear() - 100
  const maxYear = maximumDate?.getFullYear() ?? today.getFullYear() + 10
  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => maxYear - i) // newest first

  const pick = (key: string) => {
    onChange(key)
    setOpen(false)
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? formatDate(selected, pattern) : (placeholder ?? t('Chọn ngày'))}
        onPress={() => {
          setView(startOfMonth(selected ?? today))
          setYearMode(false)
          setOpen(true)
        }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
          borderColor: invalid ? c.danger : open ? c.primary : c.border, backgroundColor: c.surface,
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={open ? c.primary : c.muted} strokeWidth={1.6}>
          <Rect x={3.5} y={5} width={17} height={15} rx={2.5} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
        </Svg>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: selected ? c.text : c.muted, fontWeight: selected ? '600' : '400', fontVariant: ['tabular-nums'] }}>
          {selected ? formatDate(selected, pattern) : (placeholder ?? t('Chọn ngày'))}
        </Text>
        <Arrow d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} color={c.muted} />
      </Pressable>

      <Sheet open={open} title={placeholder ?? t('Chọn ngày')} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Năm')} onPress={() => setYearMode(!yearMode)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, textTransform: 'capitalize' }}>
              {view.toLocaleDateString(locale(), { month: 'long' })} {view.getFullYear()}
            </Text>
            <Arrow d={yearMode ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} color={c.primary} />
          </Pressable>
          {!yearMode && (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Tháng trước')} hitSlop={8} onPress={() => setView(addMonths(view, -1))} style={{ padding: 6 }}>
                <Arrow d="M15 6l-6 6 6 6" color={c.muted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Tháng sau')} hitSlop={8} onPress={() => setView(addMonths(view, 1))} style={{ padding: 6 }}>
                <Arrow d="M9 6l6 6-6 6" color={c.muted} />
              </Pressable>
            </>
          )}
        </View>

        {yearMode ? (
          <ScrollView style={{ height: 280 }} nestedScrollEnabled contentOffset={{ x: 0, y: Math.max(0, Math.floor(years.indexOf(view.getFullYear()) / 4) * 48 - 96) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {years.map((y) => {
                const active = y === view.getFullYear()
                return (
                  <Pressable key={y} accessibilityRole="button" accessibilityState={{ selected: active }}
                    onPress={() => {
                      setView(new Date(y, view.getMonth(), 1))
                      setYearMode(false)
                    }}
                    style={{ width: '25%', height: 48, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? c.primary : 'transparent' }}>
                      <Text style={{ color: active ? '#fff' : c.text, fontWeight: active ? '700' : '400' }}>{y}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {weekdays.map((w, i) => (
              <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontWeight: '600', color: c.text, paddingVertical: 6 }}>{w}</Text>
            ))}
            {days.map((d) => {
              const key = toDateKey(d)
              const isSel = !!selected && isSameDay(d, selected)
              const isToday = isSameDay(d, today)
              const disabled = outOfRange(key)
              const other = d.getMonth() !== view.getMonth()
              return (
                <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: isSel, disabled }} accessibilityLabel={formatDate(d, pattern)}
                  disabled={disabled} onPress={() => pick(key)}
                  style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSel ? c.primary : 'transparent', borderWidth: isToday && !isSel ? 1 : 0, borderColor: c.primary,
                  }}>
                    <Text style={{
                      fontVariant: ['tabular-nums'], fontWeight: isSel ? '700' : '400',
                      color: isSel ? '#fff' : isToday ? c.primary : other ? c.muted : c.text, opacity: disabled ? 0.25 : other ? 0.6 : 1,
                    }}>
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          {optional && value ? <Button variant="ghost" title={t('Xóa')} onPress={() => pick('')} /> : <View />}
          <Button title={t('Hôm nay')} disabled={outOfRange(toDateKey(today))} onPress={() => pick(toDateKey(today))} />
        </View>
      </Sheet>
    </>
  )
}
