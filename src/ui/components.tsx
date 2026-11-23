// Mobile counterparts of frontend/src/components (Form, Dialog, NavIcon) + the CSS building blocks (card, buttons, tabs).
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { t, tx } from '../i18n'
import { combine, formatDate, parseDateKey, toDateKey, toTimeValue } from '../lib/dates'
import { RADIUS, useColors } from './theme'

// ---------- Text ----------

type TxtProps = { children?: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; onPress?: () => void }

export function Txt({ children, style, numberOfLines, onPress }: TxtProps) {
  const c = useColors()
  return <Text style={[{ color: c.text, fontSize: 15 }, style]} numberOfLines={numberOfLines} onPress={onPress}>{children}</Text>
}
export const Muted = (p: TxtProps) => <Txt {...p} style={[{ color: useColors().muted, fontSize: 14 }, p.style]} />
export const H1 = (p: TxtProps) => <Txt {...p} style={[{ fontSize: 22, fontWeight: '700' }, p.style]} />
export const H2 = (p: TxtProps) => <Txt {...p} style={[{ fontSize: 16, fontWeight: '700' }, p.style]} />
/** Tappable link-style text (web <Link>). */
export const LinkText = (p: TxtProps) => <Txt {...p} style={[{ color: useColors().primary, fontWeight: '600' }, p.style]} />
export function ErrorText({ children }: { children?: ReactNode }) {
  const c = useColors()
  if (!children) return null
  return <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 14 }}>{children}</Text>
}
/** Highlighted status message (web .notice). */
export function Notice({ children }: { children: ReactNode }) {
  const c = useColors()
  return <View style={{ backgroundColor: c.successBg, borderRadius: 8, padding: 12 }}><Txt>{children}</Txt></View>
}

// ---------- Layout ----------

/** Scrollable page body (web <main class="content">). Pass scroll={false} when the child is a FlatList. */
export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  const body = scroll ? (
    <ScrollView contentContainerStyle={[{ padding: 16, gap: 12, paddingBottom: 32 }, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: 16, gap: 12 }, style]}>{children}</View>
  )
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  )
}

/** Full-screen page with safe-area insets (auth pages, no navigator header). */
export function SafeScreen({ children }: { children: ReactNode }) {
  const c = useColors()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>{children}</Screen>
    </SafeAreaView>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return (
    <View style={[{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: RADIUS, padding: 16, gap: 10 }, style]}>
      {children}
    </View>
  )
}

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>
)
/** web .row-between */
export const RowBetween = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <Row style={[{ justifyContent: 'space-between' }, style]}>{children}</Row>
)

export function Loading() {
  return <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View>
}

/** Label / value pairs (web <dl>). */
export function DefList({ items }: { items: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((i) => (
        <RowBetween key={i.label}>
          <Muted>{i.label}</Muted>
          {typeof i.value === 'string' || typeof i.value === 'number' ? <Txt style={{ fontWeight: '600', color: i.color }}>{i.value}</Txt> : i.value}
        </RowBetween>
      ))}
    </View>
  )
}

// ---------- Buttons ----------

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'outline'

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  small,
  style,
}: {
  title: string
  onPress?: () => void
  variant?: BtnVariant
  disabled?: boolean
  busy?: boolean
  small?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const c = useColors()
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : 'transparent'
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'outline' ? c.text : c.primary
  const off = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 8,
          paddingVertical: small ? 6 : 11,
          paddingHorizontal: small ? 10 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: c.border,
          opacity: off ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  )
}

/** Round "×" / icon-only button (web .icon-btn). */
export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const c = useColors()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={{ padding: 6 }}>
      {typeof children === 'string' ? <Text style={{ color: c.muted, fontSize: 20 }}>{children}</Text> : children}
    </Pressable>
  )
}

// ---------- Form fields ----------

/** web <Field>: label + control + hint/error. `error` may be a zod message key (translated via tx). */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Txt style={{ fontSize: 14, fontWeight: '500' }}>{label}</Txt>
      {children}
      {hint && !error ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
      {error ? <ErrorText>{tx(error)}</ErrorText> : null}
    </View>
  )
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const c = useColors()
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: props.invalid ? c.danger : c.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: c.text,
          backgroundColor: c.surface,
          fontSize: 15,
          textAlignVertical: props.multiline ? 'top' : 'center',
          minHeight: props.multiline ? 80 : undefined,
        },
        props.style,
      ]}
    />
  )
}

/** Password input with show/hide toggle (web PasswordInput). */
export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false)
  const c = useColors()
  return (
    <View style={{ justifyContent: 'center' }}>
      <Input {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={{ paddingRight: 44 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
        onPress={() => setVisible((v) => !v)}
        style={{ position: 'absolute', right: 10, padding: 4 }}
      >
        <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={c.muted} strokeWidth={2}>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <Circle cx={12} cy={12} r={3} />
          {visible && <Path d="M3 3l18 18" />}
        </Svg>
      </Pressable>
    </View>
  )
}

export function SwitchRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <RowBetween>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        {hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </RowBetween>
  )
}

export interface Option<T extends string | number> {
  value: T
  label: string
}

/** Dropdown replacement for <select>: opens a list in a bottom sheet. */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  placeholder,
  label,
  invalid,
}: {
  value: T | null | undefined
  options: Option<T>[]
  onChange: (v: T) => void
  placeholder?: string
  /** Sheet title + accessibility label. */
  label?: string
  invalid?: boolean
}) {
  const c = useColors()
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={{ borderWidth: 1, borderColor: invalid ? c.danger : c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: c.surface, flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text style={{ color: current ? c.text : c.muted, fontSize: 15, flex: 1 }} numberOfLines={1}>{current?.label ?? placeholder ?? '—'}</Text>
        <Text style={{ color: c.muted }}>▾</Text>
      </Pressable>
      <Sheet open={open} title={label ?? placeholder ?? ''} onClose={() => setOpen(false)}>
        {options.map((o) => (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: o.value === value }}
            onPress={() => {
              onChange(o.value)
              setOpen(false)
            }}
            style={{ paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Txt style={o.value === value ? { color: c.primary, fontWeight: '600' } : undefined}>{o.label}</Txt>
            {o.value === value ? <Txt style={{ color: c.primary }}>✓</Txt> : null}
          </Pressable>
        ))}
      </Sheet>
    </>
  )
}

/** Horizontal pill tabs / segmented control (web .tabs, view switchers). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  const c = useColors()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: active ? c.primary : c.surface, borderWidth: 1, borderColor: active ? c.primary : c.border }}
          >
            <Text style={{ color: active ? '#fff' : c.text, fontWeight: '600', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** Date picker; value/onChange use YYYY-MM-DD like <input type="date">. Empty string = no date. */
export function DateInput({
  value,
  onChange,
  pattern,
  minimumDate,
  maximumDate,
  placeholder,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  /** Display pattern from preferences (dd/MM/yyyy …). */
  pattern?: string
  minimumDate?: Date
  maximumDate?: Date
  placeholder?: string
  invalid?: boolean
}) {
  const d = parseDateKey(value)
  return (
    <PickerField
      mode="date"
      label={d ? formatDate(d, pattern) : (placeholder ?? t('Chọn ngày'))}
      empty={!d}
      invalid={invalid}
      current={d ?? new Date()}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onPick={(x) => onChange(toDateKey(x))}
    />
  )
}

/** Time picker; value/onChange use HH:mm like <input type="time">. */
export function TimeInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const current = combine(toDateKey(new Date()), value) ?? new Date()
  return <PickerField mode="time" label={value || '--:--'} empty={!value} invalid={invalid} current={current} onPick={(x) => onChange(toTimeValue(x))} />
}

function PickerField({
  mode,
  label,
  empty,
  invalid,
  current,
  minimumDate,
  maximumDate,
  onPick,
}: {
  mode: 'date' | 'time'
  label: string
  empty: boolean
  invalid?: boolean
  current: Date
  minimumDate?: Date
  maximumDate?: Date
  onPick: (d: Date) => void
}) {
  const c = useColors()
  const [iosOpen, setIosOpen] = useState(false)
  const [draft, setDraft] = useState(current)
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: true,
        minimumDate,
        maximumDate,
        onValueChange: (_e, d) => d && onPick(d),
      })
    } else {
      setDraft(current)
      setIosOpen(true)
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={open}
        style={{ borderWidth: 1, borderColor: invalid ? c.danger : c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: c.surface }}
      >
        <Text style={{ color: empty ? c.muted : c.text, fontSize: 15 }}>{label}</Text>
      </Pressable>
      {Platform.OS === 'ios' && (
        <Sheet open={iosOpen} title={mode === 'date' ? t('Chọn ngày') : t('Chọn giờ')} onClose={() => setIosOpen(false)}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onValueChange={(_e, d) => d && setDraft(d)}
          />
          <Button
            title={t('Xong')}
            onPress={() => {
              onPick(draft)
              setIosOpen(false)
            }}
          />
        </Sheet>
      )}
    </>
  )
}

// ---------- Dialogs ----------

/** Bottom sheet modal (web <Modal>): title, close ×, scrollable body. Tap the backdrop to close. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const c = useColors()
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel={t('Đóng')} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' }}>
          <RowBetween style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
            <H2 style={{ flex: 1 }}>{title}</H2>
            <IconButton label={t('Đóng')} onPress={onClose}>×</IconButton>
          </RowBetween>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

/** Right-aligned action row at the bottom of a sheet (web .modal-actions). */
export const SheetActions = ({ children }: { children: ReactNode }) => <Row style={{ justifyContent: 'flex-end', marginTop: 4 }}>{children}</Row>

/** SRS §6.1: confirmation for destructive operations. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      {typeof message === 'string' ? <Txt>{message}</Txt> : message}
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onCancel} disabled={busy} />
        <Button variant="danger" title={busy ? t('Đang xử lý…') : (confirmLabel ?? t('Xóa'))} onPress={onConfirm} disabled={busy} />
      </SheetActions>
    </Sheet>
  )
}

// ---------- Progress & icons ----------

/** Horizontal bar (finance budget / goals). */
export function Bar({ percent, color }: { percent: number; color?: string }) {
  const c = useColors()
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', backgroundColor: color ?? c.primary }} />
    </View>
  )
}

/** Small colored dot (event category). */
export const Dot = ({ color, size = 10 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
)

const ICONS = {
  home: <Path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  calendar: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  health: <Path d="M12 20s-7-4.4-9.2-8.8A5 5 0 0 1 12 6.5a5 5 0 0 1 9.2 4.7C19 15.6 12 20 12 20z" />,
  finance: (
    <>
      <Rect x={3} y={6} width={18} height={14} rx={2} />
      <Path d="M3 10h18M16 15h2" />
    </>
  ),
  goals: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={12} r={1} />
    </>
  ),
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  check: <Path d="M5 12.5 10 17.5 19 7" />,
  alert: <Path d="M12 3 2 20h20zM12 10v4M12 17.5v.01" />,
  bell: <Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  settings: (
    <>
      <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <Circle cx={16} cy={6} r={2} />
      <Circle cx={10} cy={12} r={2} />
      <Circle cx={18} cy={18} r={2} />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
}

export type IconName = keyof typeof ICONS

export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  )
}

/** Floating "+" action button (web page-header primary buttons like "Thêm giao dịch"). */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
    >
      <Icon name="plus" color="#fff" size={26} />
    </Pressable>
  )
}
