import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Pressable, View } from 'react-native'
import { z } from 'zod'
import { t, type Key } from '../../i18n'
import { addDays, combine, parseDateKey, toDateKey, toTimeValue } from '../../lib/dates'
import { applyServerErrors } from '../../lib/forms'
import { Button, DateInput, ErrorText, Field, Input, Row, Select, SheetActions, SwitchRow, TimeInput, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { EventCategory, EventDetailDto, EventInput, EventStatus } from './api'
import { CATEGORIES, MAX_REMINDERS, REMINDERS, STATUSES } from './meta'
import { useCreateEvent, useUpdateEvent } from './queries'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200, 'Tối đa 200 ký tự'),
    isAllDay: z.boolean(),
    startDate: z.string().min(1, 'Chọn ngày bắt đầu'),
    startTime: z.string(),
    endDate: z.string().min(1, 'Chọn ngày kết thúc'),
    endTime: z.string(),
    category: z.enum(['Work', 'Personal', 'Meeting', 'Health', 'Study', 'Other']),
    status: z.enum(['Planned', 'Completed', 'Cancelled']),
    location: z.string().max(200, 'Tối đa 200 ký tự'),
    description: z.string().max(4000, 'Tối đa 4000 ký tự'),
    reminders: z.array(z.string()).max(MAX_REMINDERS, 'Tối đa 5 lời nhắc' satisfies Key),
    note: z.string().max(4000, 'Tối đa 4000 ký tự'),
  })
  .superRefine((v, ctx) => {
    const range = toRange(v)
    if (!range) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Thời gian không hợp lệ' })
      return
    }
    // BR-TM-001
    if (range.end <= range.start)
      ctx.addIssue({
        code: 'custom',
        path: [v.isAllDay ? 'endDate' : 'endTime'],
        message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
      })
  })

type FormValues = z.infer<typeof schema>

/** All-day: [start date 00:00, end date + 1 day 00:00) in local time; end date in the form is inclusive. */
function toRange(v: Pick<FormValues, 'isAllDay' | 'startDate' | 'startTime' | 'endDate' | 'endTime'>) {
  if (v.isAllDay) {
    const s = parseDateKey(v.startDate)
    const e = parseDateKey(v.endDate)
    return s && e ? { start: s, end: addDays(e, 1) } : null
  }
  const s = combine(v.startDate, v.startTime)
  const e = combine(v.endDate, v.endTime)
  return s && e ? { start: s, end: e } : null
}

export type EventFormMode = { kind: 'create'; start: Date; allDay: boolean } | { kind: 'edit'; event: EventDetailDto }

export const eventFormTitle = (mode: EventFormMode) => (mode.kind === 'edit' ? t('Sửa sự kiện') : t('Tạo sự kiện'))

function defaults(mode: EventFormMode): FormValues {
  if (mode.kind === 'create') {
    const end = mode.allDay ? mode.start : new Date(mode.start.getTime() + 60 * 60_000)
    return {
      title: '',
      isAllDay: mode.allDay,
      startDate: toDateKey(mode.start),
      startTime: mode.allDay ? '09:00' : toTimeValue(mode.start),
      endDate: toDateKey(end),
      endTime: mode.allDay ? '10:00' : toTimeValue(end),
      category: 'Other',
      status: 'Planned',
      location: '',
      description: '',
      reminders: mode.allDay ? [] : ['15'],
      note: '',
    }
  }
  const e = mode.event
  const start = new Date(e.startAt)
  const end = new Date(e.endAt)
  const lastDay = e.isAllDay ? addDays(end, -1) : end
  return {
    title: e.title,
    isAllDay: e.isAllDay,
    startDate: toDateKey(start),
    startTime: toTimeValue(start),
    endDate: toDateKey(lastDay),
    endTime: toTimeValue(end),
    category: e.category,
    status: e.status,
    location: e.location ?? '',
    description: e.description ?? '',
    reminders: e.reminderOffsets.map(String),
    note: '',
  }
}

/** Body of the calendar sheet in create/edit mode (the page owns the Sheet and its title, see eventFormTitle). */
export function EventFormDialog({ mode, onClose, onSaved }: { mode: EventFormMode; onClose: () => void; onSaved: (e: EventDetailDto) => void }) {
  const c = useColors()
  const fmt = usePreferences().data?.dateFormat
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const [formError, setFormError] = useState('')
  const { handleSubmit, setError, setValue, control, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(mode),
  })
  const errors = formState.errors
  const isAllDay = useWatch({ control, name: 'isAllDay' })
  const startDate = useWatch({ control, name: 'startDate' })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    const range = toRange(v)!
    const input: EventInput = {
      title: v.title.trim(),
      startAt: range.start.toISOString(),
      endAt: range.end.toISOString(),
      isAllDay: v.isAllDay,
      description: v.description.trim() || null,
      location: v.location.trim() || null,
      category: v.category as EventCategory,
      reminderOffsets: v.reminders.map(Number),
    }
    try {
      const saved =
        mode.kind === 'create'
          ? await create.mutateAsync({ ...input, note: v.note.trim() || null })
          : await update.mutateAsync({ id: mode.event.id, body: { ...input, status: v.status as EventStatus } })
      onSaved(saved)
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  return (
    <View style={{ gap: 12 }}>
      <Field label={t('Tiêu đề')} error={errors.title?.message}>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input autoFocus maxLength={200} placeholder={t('VD: Họp nhóm, Khám răng…')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.title} />
          )}
        />
      </Field>

      <Controller
        control={control}
        name="isAllDay"
        render={({ field }) => (
          <SwitchRow
            label={t('Cả ngày')}
            value={field.value}
            onChange={(v) => {
              field.onChange(v)
              if (v) setValue('reminders', [])
            }}
          />
        )}
      />

      <Field label={t('Bắt đầu')} error={errors.startDate?.message ?? errors.startTime?.message}>
        <Row>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DateInput
                  value={field.value}
                  pattern={fmt}
                  invalid={!!errors.startDate}
                  onChange={(v) => {
                    field.onChange(v)
                    // keep the end date from falling before the new start date
                    setValue('endDate', v)
                  }}
                />
              )}
            />
          </View>
          {!isAllDay && (
            <View style={{ width: 96 }}>
              <Controller control={control} name="startTime" render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} invalid={!!errors.startTime} />} />
            </View>
          )}
        </Row>
      </Field>
      <Field label={t('Kết thúc')} error={errors.endDate?.message ?? errors.endTime?.message}>
        <Row>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <DateInput value={field.value} pattern={fmt} minimumDate={parseDateKey(startDate) ?? undefined} invalid={!!errors.endDate} onChange={field.onChange} />
              )}
            />
          </View>
          {!isAllDay && (
            <View style={{ width: 96 }}>
              <Controller control={control} name="endTime" render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} invalid={!!errors.endTime} />} />
            </View>
          )}
        </Row>
      </Field>

      <Field label={t('Phân loại')} error={errors.category?.message}>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select label={t('Phân loại')} value={field.value} onChange={field.onChange} options={CATEGORIES.map((x) => ({ value: x.value, label: t(x.label) }))} />
          )}
        />
      </Field>
      <Field label={t('Địa điểm')} error={errors.location?.message}>
        <Controller
          control={control}
          name="location"
          render={({ field }) => <Input maxLength={200} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.location} />}
        />
      </Field>
      {mode.kind === 'edit' && (
        <Field label={t('Trạng thái')} error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select label={t('Trạng thái')} value={field.value} onChange={field.onChange} options={STATUSES.map((x) => ({ value: x.value, label: t(x.label) }))} />
            )}
          />
        </Field>
      )}

      <Field label={t('Mô tả')} error={errors.description?.message}>
        <Controller
          control={control}
          name="description"
          render={({ field }) => <Input multiline maxLength={4000} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.description} />}
        />
      </Field>

      <Field label={t('Nhắc nhở')} error={errors.reminders?.message}>
        <Controller
          control={control}
          name="reminders"
          render={({ field }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {REMINDERS.map((r) => {
                const v = String(r.value)
                const checked = field.value.includes(v)
                const disabled = !checked && field.value.length >= MAX_REMINDERS
                return (
                  <Pressable
                    key={v}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled }}
                    disabled={disabled}
                    onPress={() => field.onChange(checked ? field.value.filter((x) => x !== v) : [...field.value, v])}
                    style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {checked && <Txt style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Txt>}
                    </View>
                    <Txt style={{ fontSize: 14 }}>{t(r.label)}</Txt>
                  </Pressable>
                )
              })}
            </View>
          )}
        />
      </Field>

      {mode.kind === 'create' && (
        <Field label={t('Ghi chú (không bắt buộc)')} error={errors.note?.message}>
          <Controller
            control={control}
            name="note"
            render={({ field }) => <Input multiline maxLength={4000} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} style={{ minHeight: 60 }} />}
          />
        </Field>
      )}

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onClose} />
        <Button
          title={formState.isSubmitting ? t('Đang lưu…') : mode.kind === 'create' ? t('Tạo sự kiện') : t('Lưu thay đổi')}
          busy={formState.isSubmitting}
          onPress={onSubmit}
        />
      </SheetActions>
    </View>
  )
}
