import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { t } from '../i18n'
import { Sheet } from './components'
import { useColors } from './theme'

// Same picker as the web TimeInput: field "🕐 09:30 AM ▾" → list of times + AM / PM toggle. Value is "HH:mm" (24 h) or ''.
type Period = 'AM' | 'PM'
const ROW_H = 44
const pad = (n: number) => String(n).padStart(2, '0')
const format12 = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return `${pad(h % 12 || 12)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

export function TimeInput({
  value,
  onChange,
  invalid,
  optional,
  step = 15,
  label,
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  optional?: boolean
  step?: number
  label?: string
}) {
  const c = useColors()
  const v = value ? value.slice(0, 5) : ''
  const [h24, min] = v ? v.split(':').map(Number) : [NaN, NaN]
  const currentPeriod: Period = h24 < 12 ? 'AM' : 'PM'
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('AM')

  // minutes into a 12 h half, starting at 12:00 like a clock face
  const slots = Array.from({ length: 720 / step }, (_, i) => i * step)
  const current = v ? (h24 % 12) * 60 + min : null
  if (current != null && !slots.includes(current)) slots.push(current) // keep an off-step value (e.g. 08:07) listed
  slots.sort((a, b) => a - b)

  const pick = (slot: number, p: Period) => onChange(`${pad(Math.floor(slot / 60) + (p === 'PM' ? 12 : 0))}:${pad(slot % 60)}`)
  const title = label ?? t('Chọn giờ')

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={v ? `${title}: ${format12(v)}` : title}
        onPress={() => {
          setPeriod(v ? currentPeriod : new Date().getHours() < 12 ? 'AM' : 'PM')
          setOpen(true)
        }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
          borderColor: invalid ? c.danger : open ? c.primary : c.border, backgroundColor: c.surface,
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={open ? c.primary : c.muted} strokeWidth={1.6}>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v5l3 2" strokeLinecap="round" />
        </Svg>
        <Text style={{ flex: 1, fontSize: 15, color: v ? c.text : c.muted, fontWeight: v ? '600' : '400', fontVariant: ['tabular-nums'] }}>
          {v ? format12(v) : '--:--'}
        </Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={1.8}>
          <Path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <Sheet open={open} title={title} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ScrollView
            style={{ flex: 1, height: ROW_H * 6 }}
            nestedScrollEnabled
            contentOffset={{ x: 0, y: Math.max(0, slots.indexOf(current ?? -1) * ROW_H - ROW_H * 2.5) }}
          >
            {slots.map((s) => {
              const selected = current === s && currentPeriod === period
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    pick(s, period)
                    setOpen(false)
                  }}
                  style={{ height: ROW_H, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: selected ? c.primary + '22' : 'transparent' }}
                >
                  <Text style={{ fontSize: 16, fontVariant: ['tabular-nums'], color: selected ? c.primary : s % 60 === 0 ? c.text : c.muted, fontWeight: selected ? '700' : '400' }}>
                    {pad(Math.floor(s / 60) || 12)}:{pad(s % 60)}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
          <View style={{ gap: 8 }}>
            {(['AM', 'PM'] as const).map((p) => {
              const active = period === p
              return (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setPeriod(p)
                    if (current != null) pick(current, p) // switching AM / PM moves the chosen time
                  }}
                  style={{ minWidth: 56, paddingVertical: 8, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : 'transparent' }}
                >
                  <Text style={{ fontWeight: '600', color: active ? '#fff' : c.muted }}>{p}</Text>
                </Pressable>
              )
            })}
            {optional && v ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Xóa')}
                onPress={() => {
                  onChange('')
                  setOpen(false)
                }}
                style={{ minWidth: 56, paddingVertical: 6, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: c.border }}
              >
                <Text style={{ fontSize: 18, color: c.danger }}>×</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Sheet>
    </>
  )
}
