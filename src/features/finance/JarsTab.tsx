import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { Button, Card, ErrorText, H2, Muted, Notice } from '../../ui/components'
import { JARS } from './api'
import { BudgetLine } from './BudgetTab'
import { MonthSwitcher } from './components'
import { useJars, useSyncJars } from './queries'

/** 6-jar method: the month's income split over the jars, expenses paid from the jar they are assigned to. */
export function JarsTab({ month, onMonthChange }: { month: string; onMonthChange: (m: string) => void }) {
  const { data, isPending, isError } = useJars(month)
  const sync = useSyncJars()
  const c = data?.currencyCode ?? 'VND'

  return (
    <>
      <MonthSwitcher value={month} onChange={onMonthChange} />
      <Button
        title={sync.isPending ? t('Đang đồng bộ…') : t('Đồng bộ chi tiêu tháng này')}
        disabled={!data?.unassignedCount}
        busy={sync.isPending}
        onPress={() => sync.mutate(month)}
      />

      {isPending && <Muted>{t('Đang tải…')}</Muted>}
      {isError && <ErrorText>{t('Không tải được các hũ.')}</ErrorText>}
      {sync.isError && <ErrorText>{t('Không đồng bộ được, vui lòng thử lại.')}</ErrorText>}

      {data && data.unassignedCount > 0 && (
        <Notice>
          {t('Có {count} khoản chi ({amount}) chưa được xếp vào hũ nào. Bấm “Đồng bộ” để tự xếp theo danh mục; sau đó có thể đổi hũ của từng khoản ở tab Giao dịch.', { count: data.unassignedCount, amount: formatMoney(data.unassignedSpent, c) })}
        </Notice>
      )}

      {data && (
        <Card style={{ gap: 14 }}>
          <H2>{t('Thu nhập tháng: {amount}', { amount: formatMoney(data.income, c) })}</H2>
          {data.income === 0 && <Muted>{t('Chưa có khoản thu trong tháng nên các hũ chưa có tiền.')}</Muted>}
          {data.jars.map((j) => (
            <BudgetLine
              key={j.jar}
              currency={c}
              thresholds={[80, 100]}
              line={{
                categoryId: null,
                name: `${t(JARS[j.jar].label)} · ${j.percent}%`,
                color: JARS[j.jar].color,
                limit: j.allocated,
                spent: j.spent,
                remaining: j.remaining,
                // An empty jar that was spent from is over, not 0%.
                percent: j.allocated > 0 ? Math.round((j.spent / j.allocated) * 1000) / 10 : j.spent > 0 ? 100 : 0,
                isArchived: false,
              }}
            />
          ))}
        </Card>
      )}
    </>
  )
}
