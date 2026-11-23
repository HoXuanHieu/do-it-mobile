import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Pressable, Switch, Text, View } from 'react-native'
import { z } from 'zod'
import { t, tx } from '../../i18n'
import { addDays, parseDateKey, startOfWeek, toDateKey } from '../../lib/dates'
import { applyServerErrors } from '../../lib/forms'
import { Button, DateInput, ErrorText, Field, IconButton, Input, Muted, Row, Sheet, SheetActions, TimeInput, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { GoalDto, GoalPeriod } from './api'
import { PERIOD_COLOR } from './widgets'
import { PERIODS, useCreateGoal, useUpdateGoal } from './queries'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200, 'Tối đa 200 ký tự'),
    period: z.enum(['Day', 'Week', 'Month', 'Year']),
    startDate: z.string().min(1, 'Chọn ngày bắt đầu'),
    dueDate: z.string().min(1, 'Chọn hạn hoàn thành'),
    description: z.string().max(4000, 'Tối đa 4000 ký tự'),
    plan: z.string().max(4000, 'Tối đa 4000 ký tự'),
    remind: z.boolean(),
    reminderTime: z.string(),
    steps: z
      .array(
        z.object({
          id: z.string().nullable(),
          title: z.string().trim().min(1, 'Nhập nội dung chặng').max(200, 'Tối đa 200 ký tự'),
          dueDate: z.string(),
          isDone: z.boolean(),
          result: z.string().nullable(),
        }),
      )
      .max(50, 'Tối đa 50 chặng'),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate < v.startDate)
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Hạn hoàn thành phải từ ngày bắt đầu trở đi' })
    if (v.remind && !v.reminderTime) ctx.addIssue({ code: 'custom', path: ['reminderTime'], message: 'Chọn giờ nhắc' })
  })

type FormValues = z.infer<typeof schema>

/** Default due date for a period: today / Sunday of this week / end of this month / end of this year. */
function dueFor(period: GoalPeriod, from = new Date()) {
  if (period === 'Day') return toDateKey(from)
  if (period === 'Week') return toDateKey(addDays(startOfWeek(from), 6))
  if (period === 'Month') return toDateKey(new Date(from.getFullYear(), from.getMonth() + 1, 0))
  return toDateKey(new Date(from.getFullYear(), 11, 31))
}

function defaults(goal: GoalDto | null): FormValues {
  if (!goal)
    return {
      title: '',
      period: 'Month',
      startDate: toDateKey(new Date()),
      dueDate: dueFor('Month'),
      description: '',
      plan: '',
      remind: true,
      reminderTime: '08:00',
      steps: [],
    }
  return {
    title: goal.title,
    period: goal.period,
    startDate: goal.startDate,
    dueDate: goal.dueDate,
    description: goal.description ?? '',
    plan: goal.plan ?? '',
    remind: !!goal.reminderTime,
    reminderTime: goal.reminderTime?.slice(0, 5) ?? '08:00',
    steps: goal.steps.map((s) => ({ id: s.id, title: s.title, dueDate: s.dueDate ?? '', isDone: s.isDone, result: s.result })),
  }
}

export type GoalFormMode = { kind: 'create' } | { kind: 'edit'; goal: GoalDto }

export function GoalFormDialog({ mode, onClose }: { mode: GoalFormMode | null; onClose: () => void }) {
  return (
    <Sheet open={!!mode} title={mode?.kind === 'edit' ? t('Sửa mục tiêu') : t('Mục tiêu mới')} onClose={onClose}>
      {mode && <GoalForm key={mode.kind === 'edit' ? mode.goal.id : 'new'} goal={mode.kind === 'edit' ? mode.goal : null} onClose={onClose} />}
    </Sheet>
  )
}

/** web <fieldset><legend> */
const Section = ({ legend, children }: { legend: string; children: React.ReactNode }) => (
  <View style={{ gap: 8 }}>
    <Txt style={{ fontSize: 14, fontWeight: '700' }}>{legend}</Txt>
    {children}
  </View>
)

function GoalForm({ goal, onClose }: { goal: GoalDto | null; onClose: () => void }) {
  const c = useColors()
  const create = useCreateGoal()
  const update = useUpdateGoal()
  const pattern = usePreferences().data?.dateFormat
  const [formError, setFormError] = useState('')
  const [newStep, setNewStep] = useState('')
  const { handleSubmit, setError, setValue, getValues, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(goal),
  })
  const steps = useFieldArray({ control, name: 'steps' })
  const remind = useWatch({ control, name: 'remind' })
  const startDate = useWatch({ control, name: 'startDate' })
  const errors = formState.errors

  const addStep = () => {
    const title = newStep.trim()
    if (!title || steps.fields.length >= 50) return
    steps.append({ id: null, title, dueDate: '', isDone: false, result: null }, { shouldFocus: false })
    setNewStep('')
  }

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    const body = {
      title: v.title.trim(),
      period: v.period,
      startDate: v.startDate,
      dueDate: v.dueDate,
      description: v.description.trim() || null,
      plan: v.plan.trim() || null,
      reminderTime: v.remind ? `${v.reminderTime}:00` : null,
      steps: v.steps.map((s) => ({ id: s.id, title: s.title.trim(), dueDate: s.dueDate || null, isDone: s.isDone, result: s.result })),
    }
    try {
      if (goal) await update.mutateAsync({ id: goal.id, body })
      else await create.mutateAsync(body)
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  return (
    <View style={{ gap: 14 }}>
      <Field label={t('Bạn muốn đạt được điều gì?')} error={errors.title?.message}>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input autoFocus maxLength={200} placeholder={t('VD: Chạy bộ 10km, Đọc 12 cuốn sách…')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.title} />
          )}
        />
      </Field>

      <Section legend={t('Thời hạn')}>
        <Controller
          control={control}
          name="period"
          render={({ field }) => (
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PERIODS.map((p) => {
                const on = field.value === p.value
                return (
                  <Pressable
                    key={p.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      field.onChange(p.value)
                      setValue('dueDate', dueFor(p.value, parseDateKey(getValues('startDate')) ?? new Date()))
                    }}
                    style={{ flexBasis: '47%', flexGrow: 1, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: on ? PERIOD_COLOR[p.value] : c.border, backgroundColor: on ? PERIOD_COLOR[p.value] : c.surface }}
                  >
                    <Text style={{ color: on ? '#fff' : c.text, fontWeight: '600', textAlign: 'center' }}>
                      {p.icon} {t(p.label)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        />
      </Section>

      <Field label={t('Bắt đầu')} error={errors.startDate?.message}>
        <Controller control={control} name="startDate" render={({ field }) => <DateInput value={field.value} onChange={field.onChange} pattern={pattern} invalid={!!errors.startDate} />} />
      </Field>
      <Field label={t('Hạn hoàn thành')} error={errors.dueDate?.message}>
        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => <DateInput value={field.value} onChange={field.onChange} pattern={pattern} minimumDate={parseDateKey(startDate) ?? undefined} invalid={!!errors.dueDate} />}
        />
      </Field>

      <Field label={t('Chi tiết mục tiêu: cần làm gì, đạt kết quả ra sao?')} error={errors.description?.message}>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Input multiline maxLength={4000} placeholder={t('Mô tả cụ thể, đo lường được. VD: Chạy liền 10km dưới 60 phút.')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />
          )}
        />
      </Field>
      <Field label={t('Cách để hoàn thành')} error={errors.plan?.message}>
        <Controller
          control={control}
          name="plan"
          render={({ field }) => (
            <Input multiline maxLength={4000} placeholder={t('Kế hoạch, thói quen, nguồn lực cần có… VD: Chạy 3 buổi/tuần, tăng 1km mỗi tuần.')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />
          )}
        />
      </Field>

      <Section legend={t('Các chặng nhỏ')}>
        {steps.fields.length === 0 && <Muted style={{ fontSize: 13 }}>{t('Chia mục tiêu thành từng chặng nhỏ để dễ bắt đầu và theo dõi tiến độ.')}</Muted>}
        {steps.fields.map((f, i) => (
          <View key={f.id} style={{ gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderColor: c.border }}>
            <Row>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name={`steps.${i}.title`}
                  render={({ field }) => (
                    <Input accessibilityLabel={t('Chặng {n}', { n: i + 1 })} maxLength={200} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.steps?.[i]?.title} />
                  )}
                />
              </View>
            </Row>
            <ErrorText>{errors.steps?.[i]?.title?.message && tx(errors.steps[i].title.message)}</ErrorText>
            <Row style={{ paddingLeft: 32 }}>
              <View style={{ flex: 1 }} accessibilityLabel={t('Hạn của chặng')}>
                <Controller
                  control={control}
                  name={`steps.${i}.dueDate`}
                  render={({ field }) => <DateInput value={field.value} onChange={field.onChange} pattern={pattern} placeholder={t('Hạn của chặng')} />}
                />
              </View>
              {i > 0 && <IconButton label={t('Lên')} onPress={() => steps.move(i, i - 1)}>↑</IconButton>}
              {i < steps.fields.length - 1 && <IconButton label={t('Xuống')} onPress={() => steps.move(i, i + 1)}>↓</IconButton>}
              <IconButton label={t('Xóa')} onPress={() => steps.remove(i)}>×</IconButton>
            </Row>
          </View>
        ))}
        <Row>
          <View style={{ flex: 1 }}>
            <Input maxLength={200} value={newStep} placeholder={t('Thêm chặng mới rồi nhấn Enter')} onChangeText={setNewStep} onSubmitEditing={addStep} submitBehavior="submit" returnKeyType="done" />
          </View>
          <Button variant="ghost" title={t('+ Thêm')} onPress={addStep} disabled={steps.fields.length >= 50} />
        </Row>
        <ErrorText>{errors.steps?.message && tx(errors.steps.message)}</ErrorText>
      </Section>

      <Section legend={t('Nhắc nhở')}>
        <Row>
          <Controller
            control={control}
            name="remind"
            render={({ field }) => <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel={t('Nhắc tôi mỗi ngày lúc')} />}
          />
          <Txt style={{ flex: 1 }}>{t('Nhắc tôi mỗi ngày lúc')}</Txt>
          <View style={{ opacity: remind ? 1 : 0.5 }} pointerEvents={remind ? 'auto' : 'none'} accessibilityLabel={t('Giờ nhắc')}>
            <Controller control={control} name="reminderTime" render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} invalid={!!errors.reminderTime} />} />
          </View>
        </Row>
        <ErrorText>{errors.reminderTime?.message && tx(errors.reminderTime.message)}</ErrorText>
      </Section>

      <ErrorText>{formError}</ErrorText>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onClose} />
        <Button
          title={formState.isSubmitting ? t('Đang lưu…') : goal ? t('Lưu thay đổi') : t('Tạo mục tiêu')}
          onPress={onSubmit}
          disabled={formState.isSubmitting}
        />
      </SheetActions>
    </View>
  )
}
