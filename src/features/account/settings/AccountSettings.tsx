import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import { t } from '../../../i18n'
import { applyServerErrors, PASSWORD_HINT } from '../../../lib/forms'
import { Button, Card, ErrorText, Field, H2, Muted, Notice, PasswordInput, Select, Sheet, SheetActions, SwitchRow, Txt } from '../../../ui/components'
import { useAuth } from '../../auth/AuthContext'
import { changePasswordSchema, type ChangePasswordForm } from '../../auth/schemas'
import { PreferencesCard } from './PreferencesCard'

/** Settings › Tài khoản: region, notifications, password (FR-SH-004 + FR-AUTH-005). */
export function AccountSettings() {
  return (
    <>
      <PreferencesCard title={t('Khu vực & thông báo')}>
        {({ control }, options, prefs) => (
          <>
            <Controller
              control={control}
              name="timeZone"
              render={({ field, fieldState }) => (
                <TimeZoneField current={prefs.timeZone} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="currency"
              render={({ field, fieldState }) => (
                <Field label={t('Tiền tệ')} error={fieldState.error?.message}>
                  <Select label={t('Tiền tệ')} value={field.value} onChange={field.onChange} options={options.currencies.map((c) => ({ value: c, label: c }))} />
                </Field>
              )}
            />
            <View style={{ gap: 8 }}>
              <Txt style={{ fontSize: 14, fontWeight: '500' }}>{t('Thông báo')}</Txt>
              <Controller
                control={control}
                name="inAppNotifications"
                render={({ field }) => <SwitchRow label={t('Thông báo trong ứng dụng')} value={field.value} onChange={field.onChange} />}
              />
              <Controller
                control={control}
                name="emailNotifications"
                render={({ field }) => <SwitchRow label={t('Thông báo qua email')} value={field.value} onChange={field.onChange} />}
              />
              <Muted style={{ fontSize: 12 }}>{t('Thông báo bảo mật (đổi mật khẩu…) luôn được gửi.')}</Muted>
            </View>
          </>
        )}
      </PreferencesCard>
      <ChangePasswordCard />
    </>
  )
}

function TimeZoneField({ current, value, onChange, error }: { current: string; value: string; onChange: (v: string) => void; error?: string }) {
  const zones = useMemo(() => {
    // Hermes may lack Intl.supportedValuesOf; then only the saved zone is offered.
    const all: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
    return (all.includes(current) ? all : [current, ...all]).map((z) => ({ value: z, label: z }))
  }, [current])
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <Field label={t('Múi giờ')} error={error} hint={deviceZone && deviceZone !== current ? t('Thiết bị đang dùng {zone}', { zone: deviceZone }) : undefined}>
      <Select label={t('Múi giờ')} value={value} onChange={onChange} options={zones} />
    </Field>
  )
}

function ChangePasswordCard() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <Card>
      <H2>{t('Mật khẩu')}</H2>
      {done ? <Notice>{t('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.')}</Notice> : <Muted>{t('Đổi mật khẩu sẽ đăng xuất bạn khỏi các thiết bị khác.')}</Muted>}
      <Button variant="outline" title={t('Đổi mật khẩu')} onPress={() => setOpen(true)} />
      <Sheet open={open} title={t('Đổi mật khẩu')} onClose={() => setOpen(false)}>
        {open && <PasswordForm onCancel={() => setOpen(false)} onDone={() => { setOpen(false); setDone(true) }} />}
      </Sheet>
    </Card>
  )
}

const PASSWORD_FIELDS = [
  { name: 'currentPassword', label: 'Mật khẩu hiện tại', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'Mật khẩu mới', autoComplete: 'new-password', hint: PASSWORD_HINT },
  { name: 'confirmPassword', label: 'Xác nhận mật khẩu mới', autoComplete: 'new-password' },
] as const

function PasswordForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const { changePassword } = useAuth()
  const [message, setMessage] = useState('')
  const { control, handleSubmit, setError, formState } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setMessage('')
    try {
      await changePassword(v)
      onDone()
    } catch (e) {
      setMessage(applyServerErrors(e, setError))
    }
  })

  return (
    <>
      {PASSWORD_FIELDS.map((f, i) => (
        <Controller
          key={f.name}
          control={control}
          name={f.name}
          render={({ field, fieldState }) => (
            <Field label={t(f.label)} error={fieldState.error?.message} hint={'hint' in f ? t(f.hint) : undefined}>
              <PasswordInput
                autoComplete={f.autoComplete}
                autoFocus={i === 0}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                invalid={!!fieldState.error}
              />
            </Field>
          )}
        />
      ))}
      <ErrorText>{message}</ErrorText>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onCancel} />
        <Button title={formState.isSubmitting ? t('Đang lưu…') : t('Đổi mật khẩu')} disabled={formState.isSubmitting} onPress={() => void onSubmit()} />
      </SheetActions>
    </>
  )
}
