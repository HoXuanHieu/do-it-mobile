import { useState, type ReactNode } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { t } from '../../../i18n'
import { applyServerErrors } from '../../../lib/forms'
import { Button, Card, ErrorText, H2, Loading } from '../../../ui/components'
import type { PreferenceOptionsDto, PreferencesDto } from '../api'
import { usePreferenceOptions, usePreferences, useUpdatePreferences } from '../queries'

type Render = (form: UseFormReturn<PreferencesDto>, options: PreferenceOptionsDto, prefs: PreferencesDto) => ReactNode

/** Card form over a subset of preference fields; the PUT still sends the full DTO (untouched fields keep their default values). */
export function PreferencesCard({ title, children }: { title: string; children: Render }) {
  const prefs = usePreferences()
  const options = usePreferenceOptions()

  if (!prefs.data || !options.data)
    return <Card>{prefs.isError || options.isError ? <ErrorText>{t('Không tải được cài đặt.')}</ErrorText> : <Loading />}</Card>

  return <PreferencesForm key={JSON.stringify(prefs.data)} title={title} prefs={prefs.data} options={options.data} render={children} />
}

function PreferencesForm({ title, prefs, options, render }: { title: string; prefs: PreferencesDto; options: PreferenceOptionsDto; render: Render }) {
  const update = useUpdatePreferences()
  const [message, setMessage] = useState('')
  const form = useForm<PreferencesDto>({ defaultValues: prefs })
  const { handleSubmit, setError, formState } = form

  const onSubmit = handleSubmit(async (v) => {
    setMessage('')
    try {
      await update.mutateAsync(v)
    } catch (e) {
      setMessage(applyServerErrors(e, setError))
    }
  })

  return (
    <Card>
      <H2>{title}</H2>
      {render(form, options, prefs)}
      <ErrorText>{message}</ErrorText>
      <Button
        title={formState.isSubmitting ? t('Đang lưu…') : t('Lưu cài đặt')}
        disabled={formState.isSubmitting || !formState.isDirty}
        onPress={() => void onSubmit()}
      />
    </Card>
  )
}
