// Small health-only building blocks the shared kit lacks (web .check, .goal-chip, .bmi-pill, .macro-row, .tag).
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { t } from '../../i18n'
import { Row, Txt } from '../../ui/components'
import { useColors, type Colors } from '../../ui/theme'
import type { BmiCategory } from './api'
import { BMI_LABEL, num } from './queries'

export const UNDERWEIGHT = '#0c8599'

export function Checkbox({ label, checked, onChange, disabled, a11yLabel }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; a11yLabel?: string }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={a11yLabel ?? (typeof label === 'string' ? label : undefined)}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, opacity: disabled ? 0.55 : 1 }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: checked ? c.primary : c.muted, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
      </View>
      {label === '' ? null : typeof label === 'string' ? <Txt style={{ flexShrink: 1 }}>{label}</Txt> : label}
    </Pressable>
  )
}

export function Chip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const c = useColors()
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: c.surface }}>
      <Text style={{ color: active ? c.primary : c.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  )
}

/** Muted tag (web .tag). */
export function Tag({ children }: { children: string }) {
  const c = useColors()
  return <Text style={{ fontSize: 11, color: c.muted, borderWidth: 1, borderColor: c.border, borderRadius: 4, paddingHorizontal: 5 }}>{children}</Text>
}

export const bmiColor = (cat: BmiCategory, c: Colors) =>
  ({ Underweight: UNDERWEIGHT, Normal: c.success, Overweight: c.warn, Obese: c.danger })[cat]

export function BmiPill({ cat, bmi }: { cat: BmiCategory; bmi?: number }) {
  const color = bmiColor(cat, useColors())
  return (
    <Text style={{ fontSize: 12, fontWeight: '600', color, backgroundColor: color + '26', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' }}>
      {bmi != null ? `BMI ${num(bmi)} · ` : ''}{t(BMI_LABEL[cat])}
    </Text>
  )
}

/** Wrapping row of "🥩 Đạm 120 g" items. */
export const MacroRow = ({ children }: { children: ReactNode }) => <Row style={{ flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>{children}</Row>

export const Macro = ({ label, value }: { label: string; value: ReactNode }) => (
  <Txt style={{ fontSize: 14 }}>{label} <Txt style={{ fontWeight: '700', fontSize: 14 }}>{value}</Txt></Txt>
)
