import { useState } from 'react'
import { View } from 'react-native'
import { t } from '../../i18n'
import { ApiError } from '../../lib/api'
import { addDays, formatDate, formatTime, isSameDay, weekdayName } from '../../lib/dates'
import { Button, ConfirmDialog, ErrorText, H2, Input, Loading, Muted, Row, Txt } from '../../ui/components'
import { CATEGORY_COLOR, useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { EventDetailDto, EventNoteDto, EventStatus } from './api'
import { CATEGORY_LABEL, reminderLabel, STATUS_LABEL } from './meta'
import { useDeleteEvent, useEventDetail, useNoteMutations, useSetEventStatus } from './queries'

/**
 * FR-TM-005 (details), FR-TM-010 (status), FR-TM-004 (delete), FR-TM-006 (notes).
 * Body of the calendar sheet (the page owns the Sheet so detail ↔ edit form swap without stacking modals).
 */
export function EventDetailDialog({ eventId, onClose, onEdit }: { eventId: string; onClose: () => void; onEdit: (event: EventDetailDto) => void }) {
  const { data: event, isPending, error } = useEventDetail(eventId)
  const notFound = error instanceof ApiError && error.status === 404
  if (isPending) return <Loading />
  if (notFound) return <Muted>{t('Sự kiện không tồn tại hoặc đã bị xóa.')}</Muted>
  if (error || !event) return <ErrorText>{t('Không tải được sự kiện.')}</ErrorText>
  return <EventDetail event={event} onClose={onClose} onEdit={onEdit} />
}

function useWhen(event: EventDetailDto) {
  const fmt = usePreferences().data?.dateFormat
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  const day = (d: Date) => `${weekdayName(d, 'long')}, ${formatDate(d, fmt)}`
  if (event.isAllDay) {
    const last = addDays(end, -1)
    return isSameDay(start, last) ? `${day(start)} · ${t('Cả ngày')}` : `${day(start)} → ${day(last)} · ${t('Cả ngày')}`
  }
  return isSameDay(start, end)
    ? `${day(start)} · ${formatTime(start)} – ${formatTime(end)}`
    : `${day(start)} ${formatTime(start)} → ${day(end)} ${formatTime(end)}`
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <Row style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, gap: 4 }}>
      <Txt style={{ color, fontSize: 13, fontWeight: '600' }}>{label}</Txt>
    </Row>
  )
}

function Item({ label, children }: { label: string; children: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Txt>{children}</Txt>
    </View>
  )
}

function EventDetail({ event, onClose, onEdit }: { event: EventDetailDto; onClose: () => void; onEdit: (e: EventDetailDto) => void }) {
  const c = useColors()
  const setStatus = useSetEventStatus()
  const remove = useDeleteEvent()
  const [confirming, setConfirming] = useState(false)
  const when = useWhen(event)

  const changeStatus = (status: EventStatus) => setStatus.mutate({ id: event.id, status })
  const statusColor = event.status === 'Completed' ? c.success : c.muted

  return (
    <View style={{ gap: 14 }}>
      <Row style={{ flexWrap: 'wrap' }}>
        <Tag label={t(CATEGORY_LABEL[event.category])} color={CATEGORY_COLOR[event.category]} />
        <Tag label={t(STATUS_LABEL[event.status])} color={statusColor} />
      </Row>

      <Item label={t('Thời gian')}>{when}</Item>
      {event.location ? <Item label={t('Địa điểm')}>{event.location}</Item> : null}
      <Item label={t('Nhắc nhở')}>{event.reminderOffsets.length ? event.reminderOffsets.map(reminderLabel).join(', ') : t('Không')}</Item>
      {event.description ? <Item label={t('Mô tả')}>{event.description}</Item> : null}

      <Row style={{ flexWrap: 'wrap' }}>
        {event.status !== 'Completed' && (
          <Button small variant="outline" title={`✓ ${t('Hoàn thành')}`} disabled={setStatus.isPending} onPress={() => changeStatus('Completed')} />
        )}
        {event.status !== 'Cancelled' && (
          <Button small variant="outline" title={t('Hủy sự kiện')} disabled={setStatus.isPending} onPress={() => changeStatus('Cancelled')} />
        )}
        {event.status !== 'Planned' && (
          <Button small variant="outline" title={t('Đặt lại “Đã lên lịch”')} disabled={setStatus.isPending} onPress={() => changeStatus('Planned')} />
        )}
      </Row>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button small variant="ghost" title={t('Sửa')} onPress={() => onEdit(event)} />
        <Button small variant="danger" title={t('Xóa')} onPress={() => setConfirming(true)} />
      </Row>

      <Notes event={event} />

      <ConfirmDialog
        open={confirming}
        title={t('Xóa sự kiện?')}
        message={
          <Txt>
            {t('Sự kiện')} <Txt style={{ fontWeight: '700' }}>{event.title}</Txt> {t('cùng ghi chú và lời nhắc sẽ bị xóa.')}
          </Txt>
        }
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(event.id, {
            onSuccess: () => {
              setConfirming(false)
              onClose()
            },
          })
        }
      />
    </View>
  )
}

function Notes({ event }: { event: EventDetailDto }) {
  const { add } = useNoteMutations(event.id)
  const [draft, setDraft] = useState('')

  const submit = () => {
    const content = draft.trim()
    if (!content) return
    add.mutate(content, { onSuccess: () => setDraft('') })
  }

  return (
    <View style={{ gap: 8 }}>
      <H2 style={{ fontSize: 15 }}>{t('Ghi chú ({n})', { n: event.notes.length })}</H2>
      {event.notes.map((n) => (
        <NoteItem key={n.id} eventId={event.id} note={n} />
      ))}
      <Input multiline maxLength={4000} placeholder={t('Thêm ghi chú…')} value={draft} onChangeText={setDraft} style={{ minHeight: 60 }} />
      <Button title={t('Thêm')} disabled={!draft.trim()} busy={add.isPending} onPress={submit} style={{ alignSelf: 'flex-end' }} />
    </View>
  )
}

function NoteItem({ eventId, note }: { eventId: string; note: EventNoteDto }) {
  const c = useColors()
  const { update, remove } = useNoteMutations(eventId)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.content)
  const [confirming, setConfirming] = useState(false)
  const fmt = usePreferences().data?.dateFormat
  const updated = new Date(note.updatedAt)

  return (
    <View style={{ gap: 6, borderBottomWidth: 1, borderColor: c.border, paddingBottom: 8 }}>
      {editing ? (
        <>
          <Input multiline maxLength={4000} value={text} onChangeText={setText} autoFocus />
          <Row>
            <Button
              small
              title={t('Lưu')}
              disabled={!text.trim()}
              busy={update.isPending}
              onPress={() => update.mutate({ noteId: note.id, content: text }, { onSuccess: () => setEditing(false) })}
            />
            <Button
              small
              variant="ghost"
              title={t('Hủy bỏ')}
              onPress={() => {
                setText(note.content)
                setEditing(false)
              }}
            />
          </Row>
        </>
      ) : (
        <>
          <Txt>{note.content}</Txt>
          <Row>
            <Muted style={{ fontSize: 12, flex: 1 }}>
              {formatDate(updated, fmt)} {formatTime(updated)}
            </Muted>
            <Button small variant="ghost" title={t('Sửa')} onPress={() => setEditing(true)} />
            <Txt onPress={() => setConfirming(true)} style={{ color: c.danger, fontWeight: '600', fontSize: 13, padding: 6 }}>
              {t('Xóa')}
            </Txt>
          </Row>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title={t('Xóa ghi chú?')}
        message={t('Ghi chú này sẽ bị xóa vĩnh viễn.')}
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate(note.id, { onSuccess: () => setConfirming(false) })}
      />
    </View>
  )
}
