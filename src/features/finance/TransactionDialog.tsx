import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import { t, tx } from '../../i18n'
import { toDateKey } from '../../lib/dates'
import { applyServerErrors } from '../../lib/forms'
import { formatAmountInput, parseAmount } from '../../lib/money'
import { Button, ConfirmDialog, ErrorText, Field, Input, Muted, Segmented, Select, Sheet } from '../../ui/components'
import { DateInput } from '../../ui/DatePicker'
import { usePreferences } from '../account/queries'
import { JARS, type CategoryDto, type Jar, type TransactionDto, type TransactionType } from './api'
import { AmountInput } from './components'
import { useCategories, useDeleteTransaction, useSaveTransaction } from './queries'

export type TransactionDialogMode =
  | { kind: 'create'; type: TransactionType; date?: string }
  | { kind: 'edit'; tx: TransactionDto }

/** Largest amount safely representable as a JS number with 2 decimals (backend allows more). */
const MAX = 9_999_999_999_999

function makeSchema(currency: string, jarMode: boolean) {
  return z
    .object({
      type: z.enum(['Income', 'Expense']),
      amount: z.string(),
      categoryId: z.string().min(1, 'Chọn danh mục'),
      date: z.string().min(1, 'Chọn ngày'),
      jar: z.string(),
      description: z.string().max(500, 'Tối đa 500 ký tự'),
      note: z.string().max(2000, 'Tối đa 2000 ký tự'),
    })
    .superRefine((v, ctx) => {
      const n = parseAmount(v.amount, currency)
      // BR-FI-001
      if (n == null || n <= 0 || n > MAX)
        ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Nhập số tiền lớn hơn 0 (tối đa 2 chữ số thập phân)' })
      if (jarMode && v.type === 'Expense' && !v.jar) ctx.addIssue({ code: 'custom', path: ['jar'], message: 'Chọn hũ' })
    })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

export function TransactionDialog({ mode, currency, jarMode, onClose }: { mode: TransactionDialogMode | null; currency: string; jarMode: boolean; onClose: () => void }) {
  const title = mode?.kind === 'edit' ? t('Sửa giao dịch') : mode?.type === 'Income' ? t('Thêm khoản thu') : t('Thêm khoản chi')
  return (
    <Sheet open={!!mode} title={title} onClose={onClose}>
      {mode && (
        <TransactionForm
          key={mode.kind === 'edit' ? mode.tx.id : `${mode.type}-${mode.date ?? ''}`}
          mode={mode}
          currency={mode.kind === 'edit' ? mode.tx.currencyCode : currency}
          jarMode={jarMode}
          onClose={onClose}
        />
      )}
    </Sheet>
  )
}

function TransactionForm({ mode, currency, jarMode, onClose }: { mode: TransactionDialogMode; currency: string; jarMode: boolean; onClose: () => void }) {
  const { data: categories = [] } = useCategories(true)
  const dateFormat = usePreferences().data?.dateFormat
  const save = useSaveTransaction()
  const remove = useDeleteTransaction()
  const [formError, setFormError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [todayKey] = useState(() => toDateKey(new Date()))

  const initial: FormValues =
    mode.kind === 'edit'
      ? {
          type: mode.tx.type,
          amount: formatAmountInput(mode.tx.amount, currency),
          categoryId: mode.tx.categoryId,
          date: mode.tx.date,
          jar: mode.tx.jar ?? '',
          description: mode.tx.description ?? '',
          note: mode.tx.note ?? '',
        }
      : { type: mode.type, amount: '', categoryId: '', date: mode.date ?? todayKey, jar: '', description: '', note: '' }

  const { handleSubmit, setError, setValue, control, formState } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(currency, jarMode)),
    defaultValues: initial,
  })
  const errors = formState.errors
  const type = useWatch({ control, name: 'type' })
  const currentCategory = mode.kind === 'edit' ? mode.tx.categoryId : null
  // Archived categories are hidden, except the one an edited transaction already uses.
  const options = categories.filter((c: CategoryDto) => c.type === type && (!c.isArchived || c.id === currentCategory))

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await save.mutateAsync({
        id: mode.kind === 'edit' ? mode.tx.id : undefined,
        body: {
          type: v.type,
          amount: parseAmount(v.amount, currency)!,
          categoryId: v.categoryId,
          date: v.date,
          // Sent even outside jar mode so editing there keeps the jar already assigned.
          jar: v.type === 'Expense' ? (v.jar as Jar) || null : null,
          description: v.description.trim() || null,
          note: v.note.trim() || null,
        },
      })
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(e, setError))
    }
  })

  return (
    <>
      {/* Income/expense is fixed once created; only other fields are editable. */}
      {mode.kind === 'edit' ? (
        <Muted>{type === 'Expense' ? t('Khoản chi') : t('Khoản thu')}</Muted>
      ) : (
        <Segmented<TransactionType>
          value={type}
          options={[{ value: 'Expense', label: t('Khoản chi') }, { value: 'Income', label: t('Khoản thu') }]}
          onChange={(k) => {
            setValue('type', k)
            setValue('categoryId', '')
          }}
        />
      )}

      <Field label={t('Số tiền')} error={errors.amount?.message}>
        <Controller control={control} name="amount" render={({ field }) => (
          <AmountInput currency={currency} autoFocus placeholder="0" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} invalid={!!errors.amount} />
        )} />
      </Field>
      <Field label={t('Ngày')} error={errors.date?.message}>
        <Controller control={control} name="date" render={({ field }) => (
          <DateInput value={field.value} onChange={field.onChange} pattern={dateFormat} invalid={!!errors.date} />
        )} />
      </Field>
      <Field label={t('Danh mục')} error={errors.categoryId?.message}>
        <Controller control={control} name="categoryId" render={({ field }) => (
          <Select
            label={t('Danh mục')}
            placeholder={t('— Chọn danh mục —')}
            value={field.value}
            onChange={field.onChange}
            invalid={!!errors.categoryId}
            options={options.map((c) => ({ value: c.id, label: tx(c.name) + (c.isArchived ? ` (${t('đã lưu trữ')})` : '') }))}
          />
        )} />
      </Field>
      <Field label={t('Mô tả')} error={errors.description?.message}>
        <Controller control={control} name="description" render={({ field }) => (
          <Input maxLength={500} placeholder={t('VD: Ăn trưa, Grab…')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />
        )} />
      </Field>
      {jarMode && type === 'Expense' && (
        <Field label={t('Hũ')} error={errors.jar?.message}>
          <Controller control={control} name="jar" render={({ field }) => (
            <Select
              label={t('Hũ')}
              placeholder={t('— Chọn hũ —')}
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.jar}
              options={Object.entries(JARS).map(([value, j]) => ({ value, label: t(j.label) }))}
            />
          )} />
        </Field>
      )}
      <Field label={t('Ghi chú')} error={errors.note?.message}>
        <Controller control={control} name="note" render={({ field }) => (
          <Input multiline maxLength={2000} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />
        )} />
      </Field>

      <ErrorText>{formError}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        {mode.kind === 'edit' && <Button variant="danger" title={t('Xóa')} onPress={() => setConfirming(true)} />}
        <View style={{ flex: 1 }} />
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onClose} />
        <Button title={formState.isSubmitting ? t('Đang lưu…') : t('Lưu')} busy={formState.isSubmitting} onPress={onSubmit} />
      </View>

      {mode.kind === 'edit' && (
        <ConfirmDialog
          open={confirming}
          title={t('Xóa giao dịch?')}
          message={t('Giao dịch sẽ bị xóa khỏi lịch sử và các báo cáo.')}
          busy={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            remove.mutate(mode.tx.id, {
              onSuccess: () => {
                setConfirming(false)
                onClose()
              },
            })
          }
        />
      )}
    </>
  )
}
