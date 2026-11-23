import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { t } from '../../i18n'
import { Screen, Segmented, SwitchRow } from '../../ui/components'
import { BudgetTab } from './BudgetTab'
import { CategoriesTab } from './CategoriesTab'
import { JarsTab } from './JarsTab'
import { monthKeyOf, parseMonthKey, useJars, useSetJarMode } from './queries'
import { TransactionsTab } from './TransactionsTab'

type Tab = 'transactions' | 'budget' | 'jars' | 'categories'

/** Financial Management module (SRS §4.5). Params: tab=transactions|budget|jars|categories, month=yyyy-MM */
export function FinancePage() {
  const params = useLocalSearchParams<{ tab?: string; month?: string }>()
  const [currentMonth] = useState(() => monthKeyOf(new Date()))
  const month = parseMonthKey(params.month) ? params.month! : currentMonth

  // Per-user switch: 6-jar management replaces the budget tab.
  const jarMode = useJars(month).data?.enabled ?? false
  const setJarMode = useSetJarMode()
  const tabs: { value: Tab; label: string }[] = [
    { value: 'transactions', label: t('Giao dịch') },
    jarMode ? { value: 'jars', label: t('6 hũ') } : { value: 'budget', label: t('Ngân sách') },
    { value: 'categories', label: t('Danh mục|tab') },
  ]
  const tab: Tab = tabs.find((x) => x.value === params.tab)?.value ?? 'transactions'

  const update = (patch: Record<string, string>) => router.setParams(patch)
  const onMonthChange = (m: string) => update({ month: m })

  return (
    <Screen>
      <SwitchRow
        label={t('Quản lý theo 6 hũ')}
        value={jarMode}
        onChange={(on) => {
          if (!setJarMode.isPending) setJarMode.mutate(on, { onSuccess: () => update({ tab: on ? 'jars' : 'budget' }) })
        }}
      />
      <Segmented value={tab} options={tabs} onChange={(v) => update({ tab: v })} />
      {tab === 'transactions' && <TransactionsTab month={month} jarMode={jarMode} onMonthChange={onMonthChange} />}
      {tab === 'budget' && <BudgetTab month={month} onMonthChange={onMonthChange} />}
      {tab === 'jars' && <JarsTab month={month} onMonthChange={onMonthChange} />}
      {tab === 'categories' && <CategoriesTab />}
    </Screen>
  )
}
