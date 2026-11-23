import { Controller } from 'react-hook-form'
import { t, type Key } from '../../../i18n'
import { Field, Select } from '../../../ui/components'
import type { Theme } from '../api'
import { PreferencesCard } from './PreferencesCard'

const THEME_LABEL: Record<Theme, Key> = { System: 'Theo hệ thống', Light: 'Sáng', Dark: 'Tối' }
const LANGUAGE_LABEL: Record<string, string> = { vi: 'Tiếng Việt', en: 'English' }
const DATE_FORMAT_LABEL: Record<string, string> = {
  'dd/MM/yyyy': '31/12/2026',
  'MM/dd/yyyy': '12/31/2026',
  'yyyy-MM-dd': '2026-12-31',
}

/** Settings › Appearance: theme, language, date format. Language names stay in their own language. */
export function AppearanceSettings() {
  return (
    <PreferencesCard title={t('Giao diện')}>
      {({ control }, options) => (
        <>
          <Controller
            control={control}
            name="theme"
            render={({ field, fieldState }) => (
              <Field label={t('Chủ đề')} error={fieldState.error?.message}>
                <Select label={t('Chủ đề')} value={field.value} onChange={field.onChange} options={options.themes.map((th) => ({ value: th, label: t(THEME_LABEL[th]) }))} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="language"
            render={({ field, fieldState }) => (
              <Field label={t('Ngôn ngữ')} error={fieldState.error?.message}>
                <Select label={t('Ngôn ngữ')} value={field.value} onChange={field.onChange} options={options.languages.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] ?? l }))} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="dateFormat"
            render={({ field, fieldState }) => (
              <Field label={t('Định dạng ngày')} error={fieldState.error?.message}>
                <Select
                  label={t('Định dạng ngày')}
                  value={field.value}
                  onChange={field.onChange}
                  options={options.dateFormats.map((f) => ({ value: f, label: `${DATE_FORMAT_LABEL[f] ?? f} (${f})` }))}
                />
              </Field>
            )}
          />
        </>
      )}
    </PreferencesCard>
  )
}
