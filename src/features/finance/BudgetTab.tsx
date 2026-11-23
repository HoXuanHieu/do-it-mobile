import { useState } from 'react'
import { View } from 'react-native'
import { locale, t, tx } from '../../i18n'
import { ApiError } from '../../lib/api'
import { applyServerErrors } from '../../lib/forms'
import { formatAmountInput, formatMoney, parseAmount } from '../../lib/money'
import { Button, Card, ConfirmDialog, Dot, ErrorText, Field, H2, Muted, Row, RowBetween, Sheet, SheetActions, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import type { BudgetLineDto, BudgetOverviewDto } from './api'
import { AmountInput, Chip, MonthSwitcher } from './components'
import { ProgressBar } from './ProgressBar'
import { parseMonthKey, shiftMonth, useBudget, useCategories, useCopyBudget, useDeleteBudget, useSaveBudget } from './queries'

/** FR-FI-009..012: monthly budget, category limits, usage and remaining. */
export function BudgetTab({ month, onMonthChange }: { month: string; onMonthChange: (m: string) => void }) {
  const { data: budget, isPending, isError } = useBudget(month)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copyError, setCopyError] = useState('')
  const copy = useCopyBudget()
  const remove = useDeleteBudget()

  return (
    <>
      <MonthSwitcher value={month} onChange={onMonthChange} />
      {budget?.exists && (
        <Row>
          <Button variant="outline" small title={t('Sửa ngân sách')} onPress={() => setEditing(true)} />
          <Button variant="danger" small title={t('Xóa')} onPress={() => setConfirmDelete(true)} />
        </Row>
      )}

      {isPending && <Muted>{t('Đang tải…')}</Muted>}
      {isError && <ErrorText>{t('Không tải được ngân sách.')}</ErrorText>}

      {budget && !budget.exists && (
        <Card style={{ alignItems: 'center' }}>
          <H2 style={{ textAlign: 'center' }}>{t('Chưa có ngân sách cho tháng {m}/{y}', monthVars(month))}</H2>
          <Muted style={{ textAlign: 'center' }}>
            {t('Đã chi {amount} trong tháng. Đặt hạn mức để theo dõi và nhận cảnh báo khi chi tiêu đạt {thresholds}.', {
              amount: formatMoney(budget.totalSpent, budget.currencyCode),
              thresholds: percentList(budget.alertThresholds, 'conjunction'),
            })}
          </Muted>
          <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button title={t('Tạo ngân sách')} onPress={() => setEditing(true)} />
            <Button
              variant="outline"
              title={t('Sao chép từ tháng trước')}
              disabled={copy.isPending}
              onPress={() => {
                setCopyError('')
                copy.mutate(month, {
                  onError: (e) =>
                    setCopyError(e instanceof ApiError && e.status === 404
                      ? t('Tháng {m}/{y} chưa có ngân sách để sao chép.', monthVars(shiftMonth(month, -1)))
                      : t('Không sao chép được ngân sách.')),
                })
              }}
            />
          </Row>
          <ErrorText>{copyError}</ErrorText>
        </Card>
      )}

      {budget?.exists && <BudgetOverview budget={budget} />}

      <Sheet open={editing} title={t('Ngân sách tháng {m}/{y}', monthVars(month))} onClose={() => setEditing(false)}>
        {editing && budget && <BudgetForm month={month} budget={budget} onDone={() => setEditing(false)} />}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={t('Xóa ngân sách tháng này?')}
        message={t('Hạn mức và lịch sử cảnh báo của tháng sẽ bị xóa. Giao dịch không bị ảnh hưởng.')}
        busy={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(month, { onSuccess: () => setConfirmDelete(false) })}
      />
    </>
  )
}

function BudgetOverview({ budget }: { budget: BudgetOverviewDto }) {
  const c = budget.currencyCode
  return (
    <>
      <Card>
        {budget.total ? (
          <BudgetLine line={budget.total} currency={c} thresholds={budget.alertThresholds} big />
        ) : (
          <Muted>
            {t('Không đặt tổng hạn mức. Tổng đã chi:')} <Txt style={{ fontWeight: '700' }}>{formatMoney(budget.totalSpent, c)}</Txt>
          </Muted>
        )}
      </Card>
      <Card style={{ gap: 14 }}>
        <H2>{t('Theo danh mục')}</H2>
        {budget.categories.length === 0 && <Muted>{t('Chưa đặt hạn mức theo danh mục.')}</Muted>}
        {budget.categories.map((l) => (
          <BudgetLine key={l.categoryId ?? l.name} line={l} currency={c} thresholds={budget.alertThresholds} />
        ))}
        {budget.unbudgetedSpent > 0 && (
          <Muted style={{ fontSize: 12 }}>{t('Chi tiêu ở danh mục không đặt hạn mức: {amount}', { amount: formatMoney(budget.unbudgetedSpent, c) })}</Muted>
        )}
        <Muted style={{ fontSize: 12 }}>{t('Cảnh báo khi đạt {thresholds} hạn mức.', { thresholds: percentList(budget.alertThresholds, 'unit') })}</Muted>
      </Card>
    </>
  )
}

export function BudgetLine({ line, currency, thresholds, big }: { line: BudgetLineDto; currency: string; thresholds: number[]; big?: boolean }) {
  const col = useColors()
  const over = line.remaining < 0
  return (
    <View style={{ gap: 6 }}>
      <RowBetween>
        <Row style={{ flex: 1 }}>
          {!big && <Dot color={line.color} />}
          {/* server sends its own labels for the total / deleted-category lines */}
          <Txt style={{ fontWeight: '700', fontSize: big ? 17 : 15, flexShrink: 1 }}>{tx(line.name)}</Txt>
          {line.isArchived && <Muted style={{ fontSize: 12 }}>({t('đã lưu trữ')})</Muted>}
        </Row>
        <Txt style={over ? { color: col.expense } : undefined}>{line.percent.toLocaleString('en-US')}%</Txt>
      </RowBetween>
      <ProgressBar percent={line.percent} thresholds={thresholds} />
      <RowBetween style={{ flexWrap: 'wrap' }}>
        <Muted style={{ fontSize: 12 }}>{t('Đã chi {spent} / {limit}', { spent: formatMoney(line.spent, currency), limit: formatMoney(line.limit, currency) })}</Muted>
        <Muted style={{ fontSize: 12, color: over ? col.expense : col.muted }}>
          {over ? t('Vượt {amount}', { amount: formatMoney(-line.remaining, currency) }) : t('Còn lại {amount}', { amount: formatMoney(line.remaining, currency) })}
        </Muted>
      </RowBetween>
    </View>
  )
}

/** Vars for month keys: vi uses {m}/{y}, en uses the month name. */
function monthVars(key: string) {
  const d = parseMonthKey(key)!
  return { m: d.getMonth() + 1, y: d.getFullYear(), month: d.toLocaleDateString(locale(), { month: 'long' }) }
}

const percentList = (values: number[], type: 'conjunction' | 'unit') => {
  const items = values.map((v) => `${v}%`)
  // Hermes may lack Intl.ListFormat: fall back to a plain comma list.
  return typeof Intl.ListFormat === 'function' ? new Intl.ListFormat(locale(), { type }).format(items) : items.join(', ')
}

const THRESHOLD_OPTIONS = [50, 70, 80, 90, 100]

function BudgetForm({ month, budget, onDone }: { month: string; budget: BudgetOverviewDto; onDone: () => void }) {
  const col = useColors()
  const currency = budget.currencyCode
  const save = useSaveBudget()
  const { data: categories = [] } = useCategories(false)
  const expense = categories.filter((c) => c.type === 'Expense')

  const [total, setTotal] = useState(formatAmountInput(budget.total?.limit, currency))
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(budget.categories.filter((l) => l.categoryId).map((l) => [l.categoryId!, formatAmountInput(l.limit, currency)])),
  )
  const [thresholds, setThresholds] = useState<number[]>(budget.alertThresholds)
  const [error, setError] = useState('')

  const parsedTotal = total.trim() ? parseAmount(total, currency) : null
  const categorySum = Object.values(limits).reduce((s, v) => s + (parseAmount(v, currency) ?? 0), 0)

  async function submit() {
    setError('')
    if (total.trim() && (parsedTotal == null || parsedTotal <= 0)) return setError(t('Tổng hạn mức không hợp lệ.'))
    const lines: { categoryId: string; limit: number }[] = []
    for (const [categoryId, raw] of Object.entries(limits)) {
      if (!raw.trim()) continue
      const n = parseAmount(raw, currency)
      if (n == null || n <= 0) return setError(t('Hạn mức danh mục phải là số lớn hơn 0.'))
      lines.push({ categoryId, limit: n })
    }
    if (parsedTotal == null && lines.length === 0) return setError(t('Nhập tổng hạn mức hoặc ít nhất một hạn mức danh mục.'))
    if (thresholds.length === 0) return setError(t('Chọn ít nhất một ngưỡng cảnh báo.'))
    try {
      await save.mutateAsync({ month, body: { totalLimit: parsedTotal, categories: lines, alertThresholds: thresholds } })
      onDone()
    } catch (err) {
      setError(applyServerErrors(err))
    }
  }

  return (
    <>
      <Field label={t('Tổng hạn mức tháng (để trống nếu chỉ đặt theo danh mục)')}>
        <AmountInput currency={currency} value={total} onChangeText={setTotal} placeholder={t('VD: 10,000,000')} autoFocus />
      </Field>

      <H2>{t('Hạn mức theo danh mục chi')}</H2>
      {expense.map((c) => (
        <Row key={c.id}>
          <Row style={{ flex: 1 }}>
            <Dot color={c.color} />
            <Txt style={{ flexShrink: 1 }}>{tx(c.name)}</Txt>
          </Row>
          <View style={{ width: 170 }}>
            <AmountInput currency={currency} placeholder="—" accessibilityLabel={tx(c.name)} value={limits[c.id] ?? ''}
              onChangeText={(v) => setLimits((l) => ({ ...l, [c.id]: v }))} />
          </View>
        </Row>
      ))}
      {/* Supplement SUP-FI-04 */}
      {parsedTotal != null && categorySum > parsedTotal && (
        <Txt style={{ color: col.warn, fontSize: 13 }}>{t('Tổng hạn mức các danh mục ({amount}) lớn hơn tổng ngân sách.', { amount: formatMoney(categorySum, currency) })}</Txt>
      )}

      <H2>{t('Cảnh báo khi chi tiêu đạt')}</H2>
      <Row style={{ flexWrap: 'wrap' }}>
        {THRESHOLD_OPTIONS.map((n) => {
          const on = thresholds.includes(n)
          return (
            <Chip key={n} label={`${n}%`} on={on}
              onPress={() => setThresholds((cur) => (on ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)))} />
          )
        })}
      </Row>

      <ErrorText>{error}</ErrorText>
      <SheetActions>
        <Button variant="ghost" title={t('Hủy bỏ')} onPress={onDone} />
        <Button title={save.isPending ? t('Đang lưu…') : t('Lưu ngân sách')} busy={save.isPending} onPress={submit} />
      </SheetActions>
    </>
  )
}
