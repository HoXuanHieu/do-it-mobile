import { zodResolver } from '@hookform/resolvers/zod'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form'
import type { TextInputProps } from 'react-native'
import { t, type Key } from '../../i18n'
import { ApiError } from '../../lib/api'
import { applyServerErrors, PASSWORD_HINT } from '../../lib/forms'
import { Button, ErrorText, Field, H1, Input, LinkText, Muted, Notice, PasswordInput, Row, SafeScreen, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { LegalLinks } from '../legal/LegalPage'
import { authApi } from './api'
import { useAuth } from './AuthContext'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordForm,
  type LoginForm,
  type RegisterForm,
  type ResetPasswordForm,
} from './schemas'

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const c = useColors()
  return (
    <SafeScreen>
      <Txt style={{ fontWeight: '800', letterSpacing: 1, color: c.primary, fontSize: 20 }}>DO-IT</Txt>
      <H1>{title}</H1>
      <Muted>{subtitle}</Muted>
      {children}
      <LegalLinks />
    </SafeScreen>
  )
}

/** react-hook-form text field (web: <Field><input {...register(name)} /></Field>). */
function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  password,
  ...input
}: { control: Control<T>; name: Path<T>; label: string; hint?: string; password?: boolean } & TextInputProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const props = { ...input, value: field.value ?? '', onChangeText: field.onChange, onBlur: field.onBlur, invalid: !!fieldState.error }
        return (
          <Field label={label} hint={hint} error={fieldState.error?.message}>
            {password ? <PasswordInput {...props} /> : <Input {...props} />}
          </Field>
        )
      }}
    />
  )
}

const EMAIL: TextInputProps = { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email', autoCorrect: false }

export function LoginPage() {
  const { login } = useAuth()
  const [formError, setFormError] = useState('')
  const { control, handleSubmit, setError, formState } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await login(v.email, v.password) // (auth) layout redirects to "/" once authenticated
    } catch (e) {
      // Email existence is checked first server-side, so 401 here means wrong password.
      if (e instanceof ApiError && e.status === 401) setError('password', { message: 'Mật khẩu không đúng.' satisfies Key })
      else setFormError(applyServerErrors(e, setError))
    }
  })

  return (
    <AuthCard title={t('Đăng nhập')} subtitle={t('Quản lý thời gian, sức khỏe và tài chính của bạn.')}>
      <FormInput control={control} name="email" label="Email" {...EMAIL} />
      <FormInput control={control} name="password" label={t('Mật khẩu')} password autoComplete="current-password" onSubmitEditing={() => void onSubmit()} />
      <Link href="/forgot-password"><LinkText>{t('Quên mật khẩu?')}</LinkText></Link>
      <ErrorText>{formError}</ErrorText>
      <Button title={formState.isSubmitting ? t('Đang đăng nhập…') : t('Đăng nhập')} busy={formState.isSubmitting} onPress={onSubmit} />
      <Row style={{ justifyContent: 'center' }}>
        <Muted>{t('Chưa có tài khoản?')}</Muted>
        <Link href="/register"><LinkText>{t('Đăng ký')}</LinkText></Link>
      </Row>
    </AuthCard>
  )
}

export function RegisterPage() {
  const { register: signUp } = useAuth()
  const [formError, setFormError] = useState('')
  const { control, handleSubmit, setError, formState } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await signUp({ ...v, fullName: v.fullName?.trim() || undefined })
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  return (
    <AuthCard title={t('Tạo tài khoản')} subtitle={t('Bắt đầu sắp xếp cuộc sống của bạn với DO-IT.')}>
      <FormInput control={control} name="fullName" label={t('Họ tên (không bắt buộc)')} autoComplete="name" />
      <FormInput control={control} name="email" label="Email" {...EMAIL} />
      <FormInput control={control} name="password" label={t('Mật khẩu')} hint={t(PASSWORD_HINT)} password autoComplete="new-password" />
      <FormInput control={control} name="confirmPassword" label={t('Xác nhận mật khẩu')} password autoComplete="new-password" />
      <ErrorText>{formError}</ErrorText>
      <Button title={formState.isSubmitting ? t('Đang tạo tài khoản…') : t('Đăng ký')} busy={formState.isSubmitting} onPress={onSubmit} />
      <Muted style={{ fontSize: 13 }}>
        {t('Bằng việc đăng ký, bạn đồng ý với')} <LinkText style={{ fontSize: 13 }} onPress={() => router.push('/terms')}>{t('Điều khoản sử dụng')}</LinkText> {t('và')}{' '}
        <LinkText style={{ fontSize: 13 }} onPress={() => router.push('/privacy')}>{t('Chính sách quyền riêng tư')}</LinkText>.
      </Muted>
      <Row style={{ justifyContent: 'center' }}>
        <Muted>{t('Đã có tài khoản?')}</Muted>
        <Link href="/login"><LinkText>{t('Đăng nhập')}</LinkText></Link>
      </Row>
    </AuthCard>
  )
}

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const { control, handleSubmit, setError, formState } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await authApi.forgotPassword(v.email)
      setSentTo(v.email)
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  return (
    <AuthCard title={t('Quên mật khẩu')} subtitle={t('Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.')}>
      {sentTo ? (
        <Notice>
          {t('Nếu')} <Txt style={{ fontWeight: '700' }}>{sentTo}</Txt> {t('đã được đăng ký, bạn sẽ nhận được email trong vài phút. Liên kết có hiệu lực 1 giờ.')}
        </Notice>
      ) : (
        <>
          <FormInput control={control} name="email" label="Email" {...EMAIL} onSubmitEditing={() => void onSubmit()} />
          <ErrorText>{formError}</ErrorText>
          <Button title={formState.isSubmitting ? t('Đang gửi…') : t('Gửi liên kết')} busy={formState.isSubmitting} onPress={onSubmit} />
        </>
      )}
      <Link href="/login" style={{ alignSelf: 'center' }}><LinkText>{t('Quay lại đăng nhập')}</LinkText></Link>
    </AuthCard>
  )
}

/** Opened from the reset email via doit://reset-password?uid=…&token=… */
export function ResetPasswordPage() {
  const { uid: userId, token } = useLocalSearchParams<{ uid?: string; token?: string }>()
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')
  const { control, handleSubmit, formState } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await authApi.resetPassword({ userId: userId!, token: token!, ...v })
      setDone(true)
    } catch (e) {
      // "token" errors have no matching input: surface them as a form message.
      setFormError(applyServerErrors(e))
    }
  })

  const newLink = <LinkText onPress={() => router.replace('/forgot-password')}>{t('Yêu cầu liên kết mới')}</LinkText>

  return (
    <AuthCard title={t('Đặt lại mật khẩu')} subtitle={t('Chọn mật khẩu mới cho tài khoản của bạn.')}>
      {done ? (
        <>
          <Notice>{t('Mật khẩu đã được đặt lại. Mọi phiên đăng nhập cũ đã bị đăng xuất.')}</Notice>
          <Button title={t('Đăng nhập ngay')} onPress={() => router.replace('/login')} />
        </>
      ) : !userId || !token ? (
        <>
          <ErrorText>{t('Liên kết không hợp lệ.')}</ErrorText>
          {newLink}
        </>
      ) : (
        <>
          <FormInput control={control} name="newPassword" label={t('Mật khẩu mới')} hint={t(PASSWORD_HINT)} password autoComplete="new-password" />
          <FormInput control={control} name="confirmPassword" label={t('Xác nhận mật khẩu')} password autoComplete="new-password" />
          {formError ? (
            <>
              <ErrorText>{formError}</ErrorText>
              {newLink}
            </>
          ) : null}
          <Button title={formState.isSubmitting ? t('Đang lưu…') : t('Đặt lại mật khẩu')} busy={formState.isSubmitting} onPress={onSubmit} />
        </>
      )}
      {!done && <Link href="/login" style={{ alignSelf: 'center' }}><LinkText>{t('Quay lại đăng nhập')}</LinkText></Link>}
    </AuthCard>
  )
}
