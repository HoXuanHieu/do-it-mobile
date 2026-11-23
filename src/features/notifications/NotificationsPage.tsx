import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { locale, t, type Key } from '../../i18n'
import { useColors } from '../../ui/theme'
import { Button, Card, ErrorText, Icon, IconButton, Loading, Muted, Row, RowBetween, Screen, SwitchRow, Txt } from '../../ui/components'
import { notificationsApi, type NotificationDto, type NotificationType } from './api'
import { notificationKeys } from './queries'

const PAGE_SIZE = 20

const TYPE_LABEL: Record<NotificationType, Key> = {
  System: 'Hệ thống',
  Security: 'Bảo mật',
  EventReminder: 'Nhắc lịch',
  WorkoutReminder: 'Tập luyện',
  BudgetAlert: 'Ngân sách',
  GoalReminder: 'Mục tiêu',
  HealthCheckIn: 'Sức khỏe',
}

// Deadline-style reminders the user should not miss.
const IMPORTANT: ReadonlySet<NotificationType> = new Set(['EventReminder', 'GoalReminder', 'BudgetAlert', 'Security'])

function relativeTime(iso: string, now: number) {
  // Hermes may lack Intl.RelativeTimeFormat; fall back to an absolute date-time.
  if (typeof Intl.RelativeTimeFormat !== 'function') return new Date(iso).toLocaleString(locale())
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day')
  return new Date(iso).toLocaleDateString(locale())
}

/** Web route link (e.g. "/finance?tab=budget&month=2026-11") → expo-router push with the same path/params. */
function openLink(link: string) {
  const [pathname, query = ''] = link.split('?')
  const params: Record<string, string> = {}
  for (const pair of query.split('&').filter(Boolean)) {
    const [k, v = ''] = pair.split('=')
    params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
  }
  router.push({ pathname, params } as never)
}

/** FR-SH-003: notification inbox. */
export function NotificationsPage() {
  const qc = useQueryClient()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [now] = useState(() => Date.now())

  const list = useQuery({
    queryKey: [...notificationKeys.all, { unreadOnly, page }],
    queryFn: () => notificationsApi.list({ unreadOnly, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: notificationKeys.all })
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidate })
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidate })

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.totalCount / PAGE_SIZE)) : 1

  return (
    <Screen>
      <Muted>{t('Lưu trong 90 ngày.')}</Muted>
      <Card>
        <SwitchRow
          label={t('Chỉ chưa đọc')}
          value={unreadOnly}
          onChange={(v) => {
            setUnreadOnly(v)
            setPage(1)
          }}
        />
        <Button variant="outline" small title={t('Đánh dấu tất cả đã đọc')} disabled={markAll.isPending} onPress={() => markAll.mutate()} />
      </Card>

      {list.isPending && <Loading />}
      {list.isError && <ErrorText>{t('Không tải được thông báo.')}</ErrorText>}
      {list.data?.items.length === 0 && <Muted>{t('Không có thông báo nào.')}</Muted>}
      {list.data?.items.map((n) => (
        <NotificationItem key={n.id} n={n} now={now} onRead={() => markRead.mutate(n.id)} />
      ))}

      {totalPages > 1 && (
        <RowBetween>
          <Button variant="ghost" small title={t('← Trước')} disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
          <Muted>{t('Trang {page}/{total}', { page, total: totalPages })}</Muted>
          <Button variant="ghost" small title={t('Sau →')} disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} />
        </RowBetween>
      )}
    </Screen>
  )
}

function Tag({ label, color, children }: { label: string; color: string; children?: ReactNode }) {
  return (
    <Row style={{ gap: 4, borderWidth: 1, borderColor: color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      {children}
      <Txt style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Txt>
    </Row>
  )
}

function NotificationItem({ n, now, onRead }: { n: NotificationDto; now: number; onRead: () => void }) {
  const c = useColors()
  const unread = !n.readAt
  const important = IMPORTANT.has(n.type)
  return (
    <Card style={[{ flexDirection: 'row', gap: 8 }, unread && { backgroundColor: c.unreadBg }, important && { borderLeftWidth: 4, borderLeftColor: c.warn }]}>
      <View style={{ flex: 1, gap: 6 }}>
        <Row style={{ flexWrap: 'wrap' }}>
          {important && (
            <Tag label={t('Quan trọng')} color={c.warn}>
              <Icon name="alert" color={c.warn} size={12} />
            </Tag>
          )}
          <Tag label={t(TYPE_LABEL[n.type])} color={c.muted} />
          <Muted style={{ fontSize: 12 }}>{relativeTime(n.createdAt, now)}</Muted>
        </Row>
        <Txt style={{ fontWeight: unread ? '700' : '600' }}>{n.title}</Txt>
        <Txt>{n.message}</Txt>
      </View>
      <View style={{ gap: 4 }}>
        {n.link && (
          <IconButton
            label={t('Xem chi tiết')}
            onPress={() => {
              if (unread) onRead()
              openLink(n.link!)
            }}
          >
            <Icon name="arrowRight" color={c.primary} size={20} />
          </IconButton>
        )}
        {unread && (
          <IconButton label={t('Đánh dấu đã đọc')} onPress={onRead}>
            <Icon name="check" color={c.success} size={20} />
          </IconButton>
        )}
      </View>
    </Card>
  )
}
