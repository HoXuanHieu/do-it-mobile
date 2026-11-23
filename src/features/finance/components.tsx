import { useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import { locale, t } from '../../i18n'
import { formatAmountInput, formatAmountTyping, parseAmount } from '../../lib/money'
import { Card, IconButton, Input, LinkText, Muted, Row, Sheet, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { monthKeyOf, monthLabel, parseMonthKey, shiftMonth } from './queries'

/** ‹ › Tháng 11/2026 — tapping the label opens a month/year picker sheet (web <input type="month">). */
export function MonthSwitcher({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const c = useColors()
  const [current] = useState(() => monthKeyOf(new Date()))
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(0)
  const selected = parseMonthKey(value)!
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      <IconButton label={t('Tháng trước')} onPress={() => onChange(shiftMonth(value, -1))}>‹</IconButton>
      <IconButton label={t('Tháng sau')} onPress={() => onChange(shiftMonth(value, 1))}>›</IconButton>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Chọn tháng')}
        onPress={() => {
          setYear(selected.getFullYear())
          setOpen(true)
        }}
      >
        <Txt style={{ fontSize: 17, fontWeight: '700' }}>{monthLabel(value)} ▾</Txt>
      </Pressable>
      {value !== current && <LinkText onPress={() => onChange(current)}>{t('Tháng này')}</LinkText>}
      <Sheet open={open} title={t('Chọn tháng')} onClose={() => setOpen(false)}>
        <Row style={{ justifyContent: 'center' }}>
          <IconButton label={t('Năm trước')} onPress={() => setYear((y) => y - 1)}>‹</IconButton>
          <Txt style={{ fontSize: 17, fontWeight: '700', minWidth: 60, textAlign: 'center' }}>{year}</Txt>
          <IconButton label={t('Năm sau')} onPress={() => setYear((y) => y + 1)}>›</IconButton>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: 12 }, (_, m) => {
            const active = selected.getFullYear() === year && selected.getMonth() === m
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(monthKeyOf(new Date(year, m, 1)))
                  setOpen(false)
                }}
                style={{ width: '31%', paddingVertical: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : c.surface }}
              >
                <Text style={{ color: active ? '#fff' : c.text, fontWeight: '600' }}>
                  {new Date(year, m, 1).toLocaleDateString(locale(), { month: 'short' })}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </Sheet>
    </Row>
  )
}

/**
 * Money input: shows thousand separators while typing ("1,250,000"); reformats on blur.
 * The value is the raw string; parse with parseAmount on submit.
 */
export function AmountInput({ currency, value, onChangeText, onBlur, invalid, ...props }: TextInputProps & { currency: string; value: string; invalid?: boolean }) {
  const c = useColors()
  return (
    <View style={{ justifyContent: 'center' }}>
      <Input
        keyboardType="decimal-pad"
        autoComplete="off"
        invalid={invalid}
        {...props}
        value={value}
        onChangeText={(s) => onChangeText?.(formatAmountTyping(s, currency))}
        onBlur={(e) => {
          const n = parseAmount(value, currency)
          if (n != null) onChangeText?.(formatAmountInput(n, currency))
          onBlur?.(e)
        }}
        style={{ paddingRight: 56 }}
      />
      <Text style={{ position: 'absolute', right: 12, color: c.muted }}>{currency}</Text>
    </View>
  )
}

const PALETTE = ['#2f9e44', '#0c8599', '#1971c2', '#5f3dc4', '#9c36b5', '#c2255c', '#e03131', '#e8590c', '#f08c00', '#868e96']

/** Palette swatches + a hex field for a custom color (web <input type="color">). */
export function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const c = useColors()
  const [hex, setHex] = useState(value)
  return (
    <View style={{ gap: 8 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('Màu')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PALETTE.map((p) => {
          const on = value.toLowerCase() === p
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p}
              onPress={() => {
                onChange(p)
                setHex(p)
              }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p, borderWidth: on ? 3 : 0, borderColor: c.text }}
            />
          )
        })}
      </View>
      <Row>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: value }} />
        <TextInput
          accessibilityLabel={t('Màu khác')}
          value={hex}
          maxLength={7}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="#1971c2"
          placeholderTextColor={c.muted}
          onChangeText={(s) => {
            setHex(s)
            if (/^#[0-9a-f]{6}$/i.test(s)) onChange(s.toLowerCase())
          }}
          style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: c.text }}
        />
      </Row>
    </View>
  )
}

/** Toggle chip for multi-select options (web checkbox list). */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }}
    >
      <Text style={{ color: on ? '#fff' : c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}

export function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'income' | 'expense'; hint?: string }) {
  const c = useColors()
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1, padding: 12, gap: 4 }}>
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Txt style={{ fontSize: 17, fontWeight: '700', color: tone ? c[tone] : c.text }}>{value}</Txt>
      {hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
    </Card>
  )
}

/** Category initial in a colored circle (web .cat-badge). */
export function CatBadge({ name, color }: { name: string; color: string }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{name.charAt(0)}</Text>
    </View>
  )
}
