import { zodResolver } from '@hookform/resolvers/zod'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Image, View } from 'react-native'
import { z } from 'zod'
import { t, type Key } from '../../i18n'
import { applyServerErrors } from '../../lib/forms'
import { parseDateKey } from '../../lib/dates'
import { useColors } from '../../ui/theme'
import { Button, Card, ConfirmDialog, ErrorText, Field, H2, Input, Loading, Muted, Row, Screen, Select, Txt } from '../../ui/components'
import { DateInput } from '../../ui/DatePicker'
import { useAuth } from '../auth/AuthContext'
import { profileApi, type Gender, type ProfileDto } from './api'
import { useAvatarUrl, useProfile, useSetProfile } from './queries'

const GENDERS: { value: Gender; label: Key }[] = [
  { value: 'Male', label: 'Nam' },
  { value: 'Female', label: 'Nữ' },
  { value: 'Other', label: 'Khác' },
  { value: 'PreferNotToSay', label: 'Không muốn tiết lộ' },
]

const todayIso = () => new Date().toISOString().slice(0, 10)

const schema = z.object({
  fullName: z.string().max(150, 'Tối đa 150 ký tự'),
  dateOfBirth: z
    .string()
    .refine((v) => v === '' || (v >= '1900-01-01' && v <= todayIso()), 'Ngày sinh phải từ năm 1900 đến hôm nay'),
  gender: z.enum(['', 'Male', 'Female', 'Other', 'PreferNotToSay']),
})
type Form = z.infer<typeof schema>

const MAX_AVATAR = 2 * 1024 * 1024
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT_TYPE: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/** FR-AUTH-004 */
export function ProfilePage() {
  const { data: profile, isPending, isError } = useProfile()

  return (
    <Screen>
      <Muted>{t('Thông tin cơ bản của bạn. Múi giờ và tiền tệ nằm trong Cài đặt.')}</Muted>
      {isPending && <Loading />}
      {isError && <ErrorText>{t('Không tải được hồ sơ.')}</ErrorText>}
      {profile && (
        <>
          <AvatarCard profile={profile} />
          {/* key: re-init the form when the server copy changes */}
          <ProfileForm key={profile.updatedAt} profile={profile} />
        </>
      )}
    </Screen>
  )
}

function AvatarCard({ profile }: { profile: ProfileDto }) {
  const c = useColors()
  const setProfile = useSetProfile()
  const avatarUrl = useAvatarUrl(profile)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const initials = (profile.fullName || profile.email).trim().charAt(0).toUpperCase()

  async function onPick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] })
    const asset = res.canceled ? undefined : res.assets[0]
    if (!asset) return
    setError('')
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'avatar.jpg'
    const type = asset.mimeType ?? EXT_TYPE[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/jpeg'
    if (!AVATAR_TYPES.includes(type)) return setError(t('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.'))
    if (asset.fileSize && asset.fileSize > MAX_AVATAR) return setError(t('Ảnh tối đa 2 MB.'))
    setBusy(true)
    try {
      setProfile(await profileApi.uploadAvatar({ uri: asset.uri, name, type }))
    } catch (err) {
      setError(applyServerErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    setBusy(true)
    try {
      await profileApi.deleteAvatar()
      setProfile({ ...profile, hasAvatar: false, updatedAt: new Date().toISOString() })
      setConfirm(false)
    } catch (err) {
      setError(applyServerErrors(err))
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 80, height: 80 }} accessibilityLabel={t('Ảnh đại diện')} />
        ) : (
          <Txt style={{ color: '#fff', fontSize: 30, fontWeight: '700' }}>{initials}</Txt>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt style={{ fontWeight: '700' }}>{profile.fullName || t('Chưa đặt tên')}</Txt>
        <Muted>{profile.email}</Muted>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button small variant="ghost" busy={busy} title={busy ? t('Đang xử lý…') : profile.hasAvatar ? t('Đổi ảnh') : t('Tải ảnh lên')} onPress={() => void onPick()} />
          {profile.hasAvatar && <Button small variant="ghost" disabled={busy} title={t('Xóa ảnh')} onPress={() => setConfirm(true)} />}
        </Row>
        <Muted style={{ fontSize: 12 }}>{t('JPEG, PNG hoặc WebP, tối đa 2 MB.')}</Muted>
        <ErrorText>{error}</ErrorText>
      </View>
      <ConfirmDialog
        open={confirm}
        title={t('Xóa ảnh')}
        message={t('Xóa ảnh đại diện?')}
        confirmLabel={t('Xóa ảnh')}
        busy={busy}
        onConfirm={() => void onRemove()}
        onCancel={() => setConfirm(false)}
      />
    </Card>
  )
}

function ProfileForm({ profile }: { profile: ProfileDto }) {
  const setProfile = useSetProfile()
  const { reloadUser } = useAuth()
  const [status, setStatus] = useState('')
  const { control, handleSubmit, setError, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile.fullName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: profile.gender ?? '',
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setStatus('')
    try {
      const updated = await profileApi.update({
        fullName: v.fullName.trim() || null,
        dateOfBirth: v.dateOfBirth || null,
        gender: v.gender || null,
      })
      await reloadUser()
      setProfile(updated)
    } catch (e) {
      setStatus(applyServerErrors(e, setError))
    }
  })

  return (
    <Card>
      <H2>{t('Thông tin cá nhân')}</H2>
      <Controller
        control={control}
        name="fullName"
        render={({ field, fieldState }) => (
          <Field label={t('Họ tên')} error={fieldState.error?.message}>
            <Input autoComplete="name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!fieldState.error} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field, fieldState }) => (
          <Field label={t('Ngày sinh')} error={fieldState.error?.message}>
            <DateInput value={field.value} onChange={field.onChange} minimumDate={parseDateKey('1900-01-01') ?? undefined} maximumDate={new Date()} invalid={!!fieldState.error} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="gender"
        render={({ field, fieldState }) => (
          <Field label={t('Giới tính')} error={fieldState.error?.message}>
            <Select
              label={t('Giới tính')}
              value={field.value}
              onChange={field.onChange}
              options={[{ value: '' as const, label: t('— Chưa chọn —') }, ...GENDERS.map((g) => ({ value: g.value, label: t(g.label) }))]}
            />
          </Field>
        )}
      />
      <ErrorText>{status}</ErrorText>
      <Button
        title={formState.isSubmitting ? t('Đang lưu…') : t('Lưu thay đổi')}
        disabled={formState.isSubmitting || !formState.isDirty}
        onPress={() => void onSubmit()}
      />
    </Card>
  )
}
