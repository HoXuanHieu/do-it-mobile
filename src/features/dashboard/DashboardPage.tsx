import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { locale, t } from '../../i18n'
import { addDays, formatTime, startOfDay, toDateKey } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { Card, DefList, Dot, ErrorText, H1, H2, LinkText, Loading, Muted, Row, RowBetween, Screen, Txt } from '../../ui/components'
import { CATEGORY_COLOR, useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import { useAuth } from '../auth/AuthContext'
import { eventsOnDay } from '../calendar/layout'
import { STATUS_LABEL } from '../calendar/meta'
import { useEventsInRange } from '../calendar/queries'
import { ProgressBar } from '../finance/ProgressBar'
import { monthKeyOf, monthRange, useBudget, useSummary } from '../finance/queries'
import { activeByUrgency, daysLeft, nextStep, progressOf, useGoals } from '../goals/queries'
import { ProgressRing } from '../goals/widgets'

export function DashboardPage() {
  const { user } = useAuth()
  const [today] = useState(() => new Date())
  const todayLabel = new Intl.DateTimeFormat(locale(), { dateStyle: 'full' }).format(today)
  return (
    <Screen>
      <View>
        <H1>{user?.fullName ? t('Xin chào, {name}', { name: user.fullName }) : t('Xin chào')}</H1>
        <Muted>{todayLabel}</Muted>
      </View>
      {/* FR-DASH-001 */}
      <TodaySchedule day={today} />
      <FinanceToday day={today} />
      <MonthBudget day={today} />
      <GoalsToday />
      <Card>
        <H2>{t('Sức khỏe hôm nay')}</H2>
        <Muted>{t('Chưa có dữ liệu.')}</Muted>
      </Card>
    </Screen>
  )
}

function CardHeader({ title, link, onPress }: { title: string; link: string; onPress: () => void }) {
  return (
    <RowBetween>
      <H2>{title}</H2>
      <LinkText style={{ fontSize: 14 }} onPress={onPress}>{link}</LinkText>
    </RowBetween>
  )
}

/** FR-DASH-002: current-day events in chronological order; FR-DASH-005: links into the calendar. */
function TodaySchedule({ day }: { day: Date }) {
  const c = useColors()
  const from = startOfDay(day)
  const { data, isPending, isError } = useEventsInRange(from, addDays(from, 1))
  const items = data ? eventsOnDay(data, day) : []
  const open = (event?: string) =>
    router.push({ pathname: '/calendar', params: { view: 'day', date: toDateKey(day), ...(event ? { event } : {}) } })

  return (
    <Card>
      <CardHeader title={t('Lịch hôm nay')} link={t('Xem lịch →')} onPress={() => open()} />
      {isPending && <Loading />}
      {isError && <ErrorText>{t('Không tải được lịch.')}</ErrorText>}
      {data && items.length === 0 && <Muted>{t('Hôm nay không có sự kiện nào.')}</Muted>}
      {items.map((e) => (
        <Pressable key={e.id} accessibilityRole="link" onPress={() => open(e.id)} style={{ opacity: e.status === 'Cancelled' ? 0.55 : 1 }}>
          <Row>
            <Dot color={CATEGORY_COLOR[e.category]} />
            <Txt style={{ width: 64, color: c.muted, fontVariant: ['tabular-nums'] }}>{e.isAllDay ? t('Cả ngày') : formatTime(new Date(e.startAt))}</Txt>
            <Txt style={{ flex: 1, textDecorationLine: e.status === 'Cancelled' ? 'line-through' : 'none' }} numberOfLines={1}>{e.title}</Txt>
            {e.status !== 'Planned' && <Muted style={{ fontSize: 12 }}>{t(STATUS_LABEL[e.status])}</Muted>}
          </Row>
        </Pressable>
      ))}
    </Card>
  )
}

/** FR-DASH-004: today's and this month's income / expenses. */
function FinanceToday({ day }: { day: Date }) {
  const c = useColors()
  const key = toDateKey(day)
  const { from, to } = monthRange(monthKeyOf(day))
  const today = useSummary(key, key)
  const month = useSummary(from, to)
  const currency = usePreferences().data?.currency ?? 'VND'
  const fmt = (n: number | undefined) => (n == null ? '…' : formatMoney(n, today.data?.currencyCode ?? currency))
  return (
    <Card>
      <CardHeader title={t('Tài chính')} link={t('Giao dịch →')} onPress={() => router.push('/finance')} />
      {(today.isError || month.isError) && <ErrorText>{t('Không tải được dữ liệu.')}</ErrorText>}
      <DefList
        items={[
          { label: t('Thu hôm nay'), value: fmt(today.data?.income), color: c.income },
          { label: t('Chi hôm nay'), value: fmt(today.data?.expense), color: c.expense },
          { label: t('Thu tháng này'), value: fmt(month.data?.income), color: c.income },
          { label: t('Chi tháng này'), value: fmt(month.data?.expense), color: c.expense },
        ]}
      />
    </Card>
  )
}

/** FR-DASH-004: remaining monthly budget. */
function MonthBudget({ day }: { day: Date }) {
  const c = useColors()
  const month = monthKeyOf(day)
  const { data, isPending, isError } = useBudget(month)
  const total = data?.total
  const open = () => router.push({ pathname: '/finance', params: { tab: 'budget', month } })
  return (
    <Card>
      <CardHeader title={t('Ngân sách tháng')} link={t('Chi tiết →')} onPress={open} />
      {isPending && <Loading />}
      {isError && <ErrorText>{t('Không tải được ngân sách.')}</ErrorText>}
      {data && !data.exists && (
        <Row>
          <Muted>{t('Chưa đặt ngân sách.')}</Muted>
          <LinkText onPress={open}>{t('Tạo ngay')}</LinkText>
        </Row>
      )}
      {data?.exists && !total && <Muted>{t('Chỉ đặt hạn mức theo danh mục.')}</Muted>}
      {data && total && (
        <>
          <ProgressBar percent={total.percent} thresholds={data.alertThresholds} />
          <DefList
            items={[
              { label: t('Đã chi'), value: `${formatMoney(total.spent, data.currencyCode)} (${total.percent.toLocaleString('en-US')}%)` },
              {
                label: total.remaining < 0 ? t('Vượt') : t('Còn lại'),
                value: formatMoney(Math.abs(total.remaining), data.currencyCode),
                color: total.remaining < 0 ? c.expense : c.income,
              },
            ]}
          />
        </>
      )}
    </Card>
  )
}

/** Keeps the most urgent active goals in sight every time the app opens. */
function GoalsToday() {
  const { data, isPending, isError } = useGoals()
  const goals = data ? activeByUrgency(data).slice(0, 3) : []
  return (
    <Card>
      <CardHeader title={t('Mục tiêu')} link={t('Xem tất cả →')} onPress={() => router.push('/goals')} />
      {isPending && <Loading />}
      {isError && <ErrorText>{t('Không tải được mục tiêu.')}</ErrorText>}
      {data && goals.length === 0 && (
        <Row>
          <Muted>{t('Chưa có mục tiêu đang thực hiện.')}</Muted>
          <LinkText onPress={() => router.push('/goals')}>{t('Tạo ngay')}</LinkText>
        </Row>
      )}
      {goals.map((g) => {
        const d = daysLeft(g)
        const step = nextStep(g)
        return (
          <Pressable key={g.id} accessibilityRole="link" onPress={() => router.push(`/goals/${g.id}`)}>
            <Row>
              <ProgressRing percent={progressOf(g)} size={44} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '700' }} numberOfLines={1}>{g.title}</Txt>
                <Muted style={{ fontSize: 12 }} numberOfLines={1}>
                  {d < 0 ? t('Quá hạn {n} ngày', { n: -d }) : d === 0 ? t('Hạn hôm nay') : t('Còn {n} ngày', { n: d })}
                  {step && ` · ➜ ${step.title}`}
                </Muted>
              </View>
            </Row>
          </Pressable>
        )
      })}
    </Card>
  )
}
