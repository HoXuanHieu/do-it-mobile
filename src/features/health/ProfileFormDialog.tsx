import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, type Control } from 'react-hook-form'
import { View, type TextInputProps } from 'react-native'
import { z } from 'zod'
import { t } from '../../i18n'
import { applyServerErrors } from '../../lib/forms'
import { Button, DateInput, ErrorText, Field, Input, Muted, Select, Sheet, SheetActions, Txt } from '../../ui/components'
import { usePreferences } from '../account/queries'
import type { HealthCondition, HealthProfileDto, HealthProfileInput } from './api'
import { Checkbox } from './parts'
import { ACTIVITY, CONDITIONS, GOALS, parseNum, SEXES, useCreateProfile, useUpdateProfile } from './queries'

const number = (min: number, max: number, required: boolean) =>
  z.string().refine((s) => {
    const n = parseNum(s)
    return n == null ? !required && !s.trim() : n >= min && n <= max
  }, 'Số không hợp lệ hoặc ngoài khoảng cho phép')

const schema = z.object({
  name: z.string().trim().min(1, 'Nhập tên hồ sơ').max(100, 'Tối đa 100 ký tự'),
  birthDate: z.string().min(1, 'Chọn ngày sinh'),
  sex: z.enum(['Male', 'Female']),
  heightCm: number(50, 250, true),
  weightKg: number(10, 400, true),
  targetWeightKg: number(10, 400, false),
  activityLevel: z.enum(['Sedentary', 'Light', 'Moderate', 'Active', 'VeryActive']),
  goal: z.enum(['LoseWeight', 'Maintain', 'GainWeight', 'Fitness']),
  conditions: z.array(z.string()),
  calorieTarget: number(800, 6000, false),
  checkInEveryDays: number(1, 365, false),
  notes: z.string().max(2000, 'Tối đa 2000 ký tự'),
})
type FormValues = z.infer<typeof schema>
type TextKey = 'name' | 'heightCm' | 'weightKg' | 'targetWeightKg' | 'calorieTarget' | 'checkInEveryDays' | 'notes'

const str = (n: number | null) => (n == null ? '' : String(n))

function toInput(v: FormValues): HealthProfileInput {
  return {
    name: v.name.trim(),
    birthDate: v.birthDate,
    sex: v.sex,
    heightCm: parseNum(v.heightCm)!,
    weightKg: parseNum(v.weightKg)!,
    targetWeightKg: parseNum(v.targetWeightKg),
    activityLevel: v.activityLevel,
    goal: v.goal,
    conditions: v.conditions as HealthCondition[],
    calorieTarget: parseNum(v.calorieTarget) && Math.round(parseNum(v.calorieTarget)!),
    checkInEveryDays: parseNum(v.checkInEveryDays) && Math.round(parseNum(v.checkInEveryDays)!),
    notes: v.notes.trim() || null,
  }
}

export function ProfileFormDialog({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean
  profile?: HealthProfileDto
  onClose: () => void
  onSaved?: (p: HealthProfileDto) => void
}) {
  return (
    <Sheet open={open} title={profile ? t('Sửa hồ sơ sức khỏe') : t('Tạo hồ sơ sức khỏe')} onClose={onClose}>
      {open && <ProfileForm profile={profile} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

/** Text input bound to a string form field (web <input {...register()} />). */
function TextField({ control, name, label, hint, ...input }: { control: Control<FormValues>; name: TextKey; label: string; hint?: string } & TextInputProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} error={fieldState.error?.message} hint={hint}>
          <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!fieldState.error} {...input} />
        </Field>
      )}
    />
  )
}

function ProfileForm({ profile, onClose, onSaved }: { profile?: HealthProfileDto; onClose: () => void; onSaved?: (p: HealthProfileDto) => void }) {
  const create = useCreateProfile()
  const update = useUpdateProfile()
  const dateFormat = usePreferences().data?.dateFormat
  const [formError, setFormError] = useState('')
  const { control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: profile
      ? {
          name: profile.name,
          birthDate: profile.birthDate,
          sex: profile.sex,
          heightCm: str(profile.heightCm),
          weightKg: str(profile.weightKg),
          targetWeightKg: str(profile.targetWeightKg),
          activityLevel: profile.activityLevel,
          goal: profile.goal,
          conditions: profile.conditions,
          calorieTarget: str(profile.calorieTarget),
          checkInEveryDays: str(profile.checkInEveryDays),
          notes: profile.notes ?? '',
        }
      : {
          name: '', birthDate: '', sex: 'Male', heightCm: '', weightKg: '', targetWeightKg: '', activityLevel: 'Light',
          goal: 'Maintain', conditions: [], calorieTarget: '', checkInEveryDays: '14', notes: '',
        },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      const body = toInput(v)
      const saved = profile ? await update.mutateAsync({ id: profile.id, body }) : await create.mutateAsync(body)
      onClose()
      onSaved?.(saved)
    } catch (err) {
      setFormError(applyServerErrors(err, setError))
    }
  })

  return (
    <>
      <TextField control={control} name="name" label={t('Tên hồ sơ')} autoFocus maxLength={100} placeholder={t('VD: Tôi, Bố, Mẹ…')} />
      <Controller
        control={control}
        name="birthDate"
        render={({ field, fieldState }) => (
          <Field label={t('Ngày sinh')} error={fieldState.error?.message}>
            <DateInput value={field.value} onChange={field.onChange} pattern={dateFormat} maximumDate={new Date()} invalid={!!fieldState.error} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="sex"
        render={({ field }) => (
          <Field label={t('Giới tính')}>
            <Select label={t('Giới tính')} value={field.value} onChange={field.onChange} options={SEXES.map((s) => ({ value: s.value, label: t(s.label) }))} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="goal"
        render={({ field }) => (
          <Field label={t('Mục tiêu')}>
            <Select label={t('Mục tiêu')} value={field.value} onChange={field.onChange} options={GOALS.map((g) => ({ value: g.value, label: `${g.icon} ${t(g.label)}` }))} />
          </Field>
        )}
      />
      <TextField control={control} name="heightCm" label={t('Chiều cao (cm)')} keyboardType="decimal-pad" placeholder="170" />
      <TextField control={control} name="weightKg" label={t('Cân nặng (kg)')} keyboardType="decimal-pad" placeholder="65" />
      <TextField control={control} name="targetWeightKg" label={t('Cân nặng mục tiêu (kg)')} hint={t('Không bắt buộc')} keyboardType="decimal-pad" />
      <Controller
        control={control}
        name="activityLevel"
        render={({ field }) => (
          <Field label={t('Mức độ vận động')}>
            <Select label={t('Mức độ vận động')} value={field.value} onChange={field.onChange}
              options={ACTIVITY.map((a) => ({ value: a.value, label: `${t(a.label)} — ${t(a.hint)}` }))} />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="conditions"
        render={({ field }) => (
          <View style={{ gap: 2 }}>
            <Txt style={{ fontSize: 14, fontWeight: '500' }}>{t('Tình trạng cần lưu ý')}</Txt>
            {CONDITIONS.map((c) => (
              <Checkbox key={c.value} label={t(c.label)} checked={field.value.includes(c.value)}
                onChange={(on) => field.onChange(on ? [...field.value, c.value] : field.value.filter((x) => x !== c.value))} />
            ))}
            <Muted style={{ fontSize: 12 }}>{t('Dùng để loại bỏ bài tập và món ăn không phù hợp.')}</Muted>
          </View>
        )}
      />

      <TextField control={control} name="calorieTarget" label={t('Calo mục tiêu mỗi ngày (kcal)')} hint={t('Để trống để hệ thống tự ước tính')} keyboardType="number-pad" />
      <TextField control={control} name="checkInEveryDays" label={t('Nhắc đo lại chỉ số sau (ngày)')} hint={t('Để trống để tắt nhắc nhở')} keyboardType="number-pad" />
      <TextField control={control} name="notes" label={t('Ghi chú sức khỏe')} multiline maxLength={2000} placeholder={t('VD: dị ứng hải sản, đang uống thuốc huyết áp…')} />

      <ErrorText>{formError}</ErrorText>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onClose} />
        <Button title={formState.isSubmitting ? t('Đang lưu…') : t('Lưu')} busy={formState.isSubmitting} onPress={() => void onSubmit()} />
      </SheetActions>
    </>
  )
}
