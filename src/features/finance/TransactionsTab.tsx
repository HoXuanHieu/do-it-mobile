import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { t, t as tr, tx } from '../../i18n'
import { formatDate, parseDateKey, weekdayName } from '../../lib/dates'
import { formatAmountTyping, formatMoney, parseAmount } from '../../lib/money'
import { Button, Card, ErrorText, Input, LinkText, Muted, Row, RowBetween, Select, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import { JARS, type TransactionDto, type TransactionType } from './api'
import { CatBadge, MonthSwitcher, Stat } from './components'
import { monthRange, useCategories, useSummary, useTransactions } from './queries'
import { TransactionDialog, type TransactionDialogMode } from './TransactionDialog'

const PAGE_SIZE = 30

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** FR-FI-001..006, 008: monthly transaction history with summary, filters and search. */
export function TransactionsTab({ month, jarMode, onMonthChange }: { month: string; jarMode: boolean; onMonthChange: (m: string) => void }) {
  const c = useColors()
  const prefs = usePreferences().data
  const currency = prefs?.currency ?? 'VND'
  const dateFormat = prefs?.dateFormat
  const { from, to } = monthRange(month)

  const [type, setType] = useState<TransactionType | ''>('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [minRaw, setMinRaw] = useState('')
  const [maxRaw, setMaxRaw] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<TransactionDialogMode | null>(null)

  const q = useDebounced(search, 300)
  const min = parseAmount(useDebounced(minRaw, 400), currency) ?? undefined
  const max = parseAmount(useDebounced(maxRaw, 400), currency) ?? undefined

  // Reset paging whenever the filter set changes.
  const filterKey = `${month}|${type}|${categoryId}|${q}|${min}|${max}`
  const [lastKey, setLastKey] = useState(filterKey)
  if (filterKey !== lastKey) {
    setLastKey(filterKey)
    setPage(1)
  }

  const { data: categories = [] } = useCategories(true)
  const summary = useSummary(from, to)
  const list = useTransactions({
    from, to, type: type || undefined, categoryId: categoryId || undefined, q: q || undefined,
    minAmount: min, maxAmount: max, page, pageSize: PAGE_SIZE,
  })

  const items = list.data?.items ?? []
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.totalCount / PAGE_SIZE)) : 1
  const groups = groupByDate(items)
  const filtered = !!(type || categoryId || q || min || max)
  const s = summary.data

  return (
    <>
      <MonthSwitcher value={month} onChange={onMonthChange} />
      <Row>
        <Button variant="outline" style={{ flex: 1 }} title={t('+ Khoản thu')} onPress={() => setDialog({ kind: 'create', type: 'Income' })} />
        <Button style={{ flex: 1 }} title={t('+ Khoản chi')} onPress={() => setDialog({ kind: 'create', type: 'Expense' })} />
      </Row>

      {/* Summary (BR-FI-004: income and expense separate) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Stat label={t('Tổng thu')} value={s ? formatMoney(s.income, s.currencyCode) : '…'} tone="income" />
        <Stat label={t('Tổng chi')} value={s ? formatMoney(s.expense, s.currencyCode) : '…'} tone="expense" />
        <Stat label={t('Chênh lệch')} value={s ? formatMoney(s.net, s.currencyCode, { signed: true }) : '…'} tone={s && s.net < 0 ? 'expense' : 'income'} />
        <Stat label={t('Tỷ lệ tiết kiệm')} value={s ? (s.savingsRate == null ? '—' : `${s.savingsRate.toLocaleString('en-US')}%`) : '…'} />
      </View>

      {/* FR-FI-006 / FR-FI-008 */}
      <Input placeholder={t('Tìm mô tả, ghi chú, danh mục…')} value={search} onChangeText={setSearch} accessibilityLabel={t('Tìm giao dịch')} returnKeyType="search" />
      <Row>
        <View style={{ flex: 1 }}>
          <Select<TransactionType | ''>
            label={t('Loại')}
            value={type}
            onChange={(v) => {
              setType(v)
              setCategoryId('')
            }}
            options={[
              { value: '', label: t('Thu & chi') },
              { value: 'Income', label: t('Chỉ khoản thu') },
              { value: 'Expense', label: t('Chỉ khoản chi') },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select
            label={t('Danh mục')}
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: t('Tất cả danh mục') },
              ...categories
                .filter((x) => !type || x.type === type)
                .map((x) => ({ value: x.id, label: tx(x.name) + (x.isArchived ? ` (${t('đã lưu trữ')})` : '') })),
            ]}
          />
        </View>
      </Row>
      <Row>
        <Input style={{ flex: 1 }} keyboardType="decimal-pad" placeholder={t('Từ số tiền')} value={minRaw}
          onChangeText={(v) => setMinRaw(formatAmountTyping(v, currency))} accessibilityLabel={t('Số tiền tối thiểu')} />
        <Input style={{ flex: 1 }} keyboardType="decimal-pad" placeholder={t('Đến số tiền')} value={maxRaw}
          onChangeText={(v) => setMaxRaw(formatAmountTyping(v, currency))} accessibilityLabel={t('Số tiền tối đa')} />
      </Row>
      {filtered && (
        <LinkText onPress={() => { setType(''); setCategoryId(''); setSearch(''); setMinRaw(''); setMaxRaw('') }}>
          {t('Xóa bộ lọc')}
        </LinkText>
      )}

      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        {list.isPending && <Muted style={{ padding: 16 }}>{t('Đang tải…')}</Muted>}
        {list.isError && <View style={{ padding: 16 }}><ErrorText>{t('Không tải được giao dịch.')}</ErrorText></View>}
        {list.data && items.length === 0 && (
          <View style={{ padding: 16, gap: 12, alignItems: 'center' }}>
            <Muted>{filtered ? t('Không có giao dịch phù hợp bộ lọc.') : t('Chưa có giao dịch nào trong tháng này.')}</Muted>
            {!filtered && <Button title={t('Ghi khoản chi đầu tiên')} onPress={() => setDialog({ kind: 'create', type: 'Expense' })} />}
          </View>
        )}
        {groups.map(([date, txs], gi) => {
          const d = parseDateKey(date)!
          const dayNet = txs.reduce((sum, x) => sum + (x.type === 'Income' ? x.amount : -x.amount), 0)
          const day = `${weekdayName(d, 'long')}, ${formatDate(d, dateFormat)}`
          return (
            <View key={date} style={{ borderTopWidth: gi ? 1 : 0, borderColor: c.border }}>
              <RowBetween style={{ backgroundColor: c.bg, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Muted style={{ fontSize: 13, fontWeight: '600' }}>{day.charAt(0).toUpperCase() + day.slice(1)}</Muted>
                <Txt style={{ fontSize: 13, fontWeight: '600', color: dayNet >= 0 ? c.income : c.expense }}>
                  {formatMoney(dayNet, txs[0].currencyCode, { signed: true })}
                </Txt>
              </RowBetween>
              {txs.map((x) => {
                const sub = [
                  x.description && tx(x.categoryName),
                  jarMode && x.type === 'Expense' && (x.jar ? tr('Hũ {name}', { name: tr(JARS[x.jar].label) }) : tr('Chưa xếp hũ')),
                  x.note,
                ].filter(Boolean).join(' · ')
                return (
                  <Pressable key={x.id} accessibilityRole="button" onPress={() => setDialog({ kind: 'edit', tx: x })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
                    <CatBadge name={tx(x.categoryName)} color={x.categoryColor} />
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: '600' }} numberOfLines={1}>{x.description || tx(x.categoryName)}</Txt>
                      {sub ? <Muted style={{ fontSize: 12 }} numberOfLines={1}>{sub}</Muted> : null}
                    </View>
                    <Txt style={{ fontWeight: '600', color: x.type === 'Income' ? c.income : c.expense }}>
                      {formatMoney(x.type === 'Income' ? x.amount : -x.amount, x.currencyCode, { signed: true })}
                    </Txt>
                  </Pressable>
                )
              })}
            </View>
          )
        })}
      </Card>

      {totalPages > 1 && (
        <RowBetween>
          <Button small variant="ghost" title={t('← Trước')} disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
          <Muted style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
            {t('Trang {page}/{pages} · {count} giao dịch', { page, pages: totalPages, count: list.data?.totalCount ?? 0 })}
          </Muted>
          <Button small variant="ghost" title={t('Sau →')} disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} />
        </RowBetween>
      )}

      <TransactionDialog mode={dialog} currency={currency} jarMode={jarMode} onClose={() => setDialog(null)} />
    </>
  )
}

function groupByDate(items: TransactionDto[]) {
  const map = new Map<string, TransactionDto[]>()
  for (const x of items) map.set(x.date, [...(map.get(x.date) ?? []), x])
  return [...map.entries()]
}
