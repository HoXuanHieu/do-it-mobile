import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { t } from '../../i18n'
import { formatDate, parseDateKey } from '../../lib/dates'
import { Button, Card, ConfirmDialog, ErrorText, H2, Input, LinkText, Loading, Muted, Row, RowBetween, Screen, Txt } from '../../ui/components'
import { useColors } from '../../ui/theme'
import { usePreferences } from '../account/queries'
import type { GoalDto, GoalStepDto } from './api'
import { GoalFormDialog } from './GoalFormDialog'
import { nextStep, PERIODS, progressOf, useDeleteGoal, useGoals, useSetGoalStatus, useUpdateStep } from './queries'
import { DueBadge, PERIOD_COLOR, ProgressRing } from './widgets'

/** /goals/[id]: one goal with its details, plan and steps. */
export function GoalDetailPage() {
  const c = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: goals, isPending, isError } = useGoals()
  const toggle = useUpdateStep()
  const setStatus = useSetGoalStatus()
  const remove = useDeleteGoal()
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const dateFormat = usePreferences().data?.dateFormat
  const fmt = (key: string) => formatDate(parseDateKey(key)!, dateFormat)

  if (isPending) return <Screen><Loading /></Screen>
  if (isError) return <Screen><ErrorText>{t('Không tải được mục tiêu.')}</ErrorText></Screen>
  const goal = goals.find((g) => g.id === id)
  if (!goal)
    return (
      <Screen>
        <Muted>{t('Không tìm thấy mục tiêu này.')}</Muted>
        <LinkText onPress={() => router.back()}>{t('← Tất cả mục tiêu')}</LinkText>
      </Screen>
    )

  const period = PERIODS.find((p) => p.value === goal.period)!
  const color = PERIOD_COLOR[goal.period]
  const done = goal.steps.filter((s) => s.isDone).length
  const allDone = goal.steps.length > 0 && done === goal.steps.length
  const next = nextStep(goal)
  const busy = setStatus.isPending

  return (
    <Screen>
      <Stack.Screen options={{ title: goal.title }} />

      <View style={{ backgroundColor: color, borderRadius: 18, padding: 18, gap: 12 }}>
        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
          <ProgressRing percent={progressOf(goal)} size={88} color="#fff" />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
              {period.icon} {t(period.label)} · {fmt(goal.startDate)} → {fmt(goal.dueDate)}
            </Text>
            <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{goal.title}</Text>
            <DueBadge goal={goal} />
            {goal.reminderTime && goal.status === 'Active' && (
              <Text style={{ color: '#fff', fontSize: 12 }}>🔔 {t('Nhắc lúc {time} mỗi ngày', { time: goal.reminderTime.slice(0, 5) })}</Text>
            )}
          </View>
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {goal.status === 'Active' ? (
            <>
              {!allDone && <HeroBtn solid color={color} title={t('Hoàn thành')} disabled={busy} onPress={() => setStatus.mutate({ id: goal.id, status: 'Completed' })} />}
              <HeroBtn title={t('Sửa')} onPress={() => setEditing(true)} />
              <HeroBtn title={t('Tạm dừng')} disabled={busy} onPress={() => setStatus.mutate({ id: goal.id, status: 'Abandoned' })} />
            </>
          ) : (
            <HeroBtn solid color={color} title={t('Tiếp tục thực hiện')} disabled={busy} onPress={() => setStatus.mutate({ id: goal.id, status: 'Active' })} />
          )}
          <HeroBtn title={t('Xóa')} onPress={() => setConfirm(true)} />
        </Row>
      </View>

      {allDone && goal.status === 'Active' && (
        <View accessibilityRole="alert" style={{ backgroundColor: c.successBg, borderRadius: 12, padding: 14, gap: 10 }}>
          <Txt>🎉 {t('Tuyệt vời! Bạn đã hoàn thành mọi chặng.')}</Txt>
          <Button title={t('Đánh dấu hoàn thành')} disabled={busy} onPress={() => setStatus.mutate({ id: goal.id, status: 'Completed' })} />
        </View>
      )}
      {(toggle.isError || setStatus.isError) && <ErrorText>{t('Không lưu được, vui lòng thử lại.')}</ErrorText>}

      <Card>
        <H2>🎯 {t('Cần đạt được')}</H2>
        {goal.description ? <Txt>{goal.description}</Txt> : <Muted>{t('Chưa có mô tả.')}</Muted>}
      </Card>
      <Card>
        <H2>🧭 {t('Cách thực hiện')}</H2>
        {goal.plan ? <Txt>{goal.plan}</Txt> : <Muted>{t('Chưa có kế hoạch.')}</Muted>}
      </Card>

      <Card>
        <RowBetween>
          <H2>✅ {t('Các chặng')}</H2>
          {goal.steps.length > 0 && <Muted style={{ fontSize: 12 }}>{t('{done}/{total} chặng', { done, total: goal.steps.length })}</Muted>}
        </RowBetween>
        {goal.steps.length === 0 && <Muted>{t('Chưa có chặng nào. Bấm “Sửa” để chia nhỏ mục tiêu.')}</Muted>}
        {goal.steps.map((s) => (
          <StepItem key={s.id} goal={goal} step={s} isNext={s === next} due={s.dueDate && fmt(s.dueDate)} color={color} />
        ))}
      </Card>

      <GoalFormDialog mode={editing ? { kind: 'edit', goal } : null} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirm}
        title={t('Xóa mục tiêu?')}
        message={t('Mục tiêu “{title}” và các chặng của nó sẽ bị xóa.', { title: goal.title })}
        busy={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => remove.mutate(goal.id, { onSuccess: () => { setConfirm(false); router.back() } })}
      />
    </Screen>
  )
}

/** web .btn-hero (white, solid) / .btn-hero-ghost (outlined) on the colored hero. */
function HeroBtn({ title, onPress, disabled, solid, color }: { title: string; onPress: () => void; disabled?: boolean; solid?: boolean; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: solid ? '#fff' : 'rgba(255,255,255,0.6)', backgroundColor: solid ? '#fff' : 'transparent', opacity: disabled ? 0.6 : 1 }}
    >
      <Text style={{ color: solid ? color : '#fff', fontWeight: '700' }}>{title}</Text>
    </Pressable>
  )
}

/** One step: tick it, and write down what was actually achieved. */
function StepItem({ goal, step, isNext, due, color }: { goal: GoalDto; step: GoalStepDto; isNext: boolean; due: string | null; color: string }) {
  const c = useColors()
  const update = useUpdateStep()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const active = goal.status === 'Active'
  const off = update.isPending || !active

  const save = () =>
    update.mutate({ id: goal.id, stepId: step.id, result: draft.trim() }, { onSuccess: () => setEditing(false) })

  return (
    <View style={{ gap: 6, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: step.isDone ? c.success : isNext ? color : c.border }}>
      <RowBetween style={{ alignItems: 'flex-start' }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: step.isDone, disabled: off }}
          disabled={off}
          onPress={() => update.mutate({ id: goal.id, stepId: step.id, isDone: !step.isDone })}
          style={{ flexDirection: 'row', gap: 8, flex: 1, opacity: off && !active ? 0.7 : 1 }}
        >
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: step.isDone ? c.success : c.border, backgroundColor: step.isDone ? c.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {step.isDone && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>✓</Text>}
          </View>
          <Txt style={{ flex: 1, fontWeight: isNext ? '700' : '400', textDecorationLine: step.isDone ? 'line-through' : 'none', color: step.isDone ? c.muted : c.text }}>{step.title}</Txt>
        </Pressable>
        {due && <Muted style={{ fontSize: 12 }}>{due}</Muted>}
      </RowBetween>

      {editing ? (
        <View style={{ gap: 6 }}>
          <Input
            autoFocus
            multiline
            maxLength={2000}
            value={draft}
            accessibilityLabel={t('Kết quả của chặng “{title}”', { title: step.title })}
            placeholder={t('VD: Chạy được 7km trong 48 phút, chân hơi mỏi.')}
            onChangeText={setDraft}
            style={{ minHeight: 60 }}
          />
          <Row>
            <Button small title={update.isPending ? t('Đang lưu…') : t('Lưu')} disabled={update.isPending} onPress={save} />
            <Button small variant="ghost" title={t('Hủy bỏ')} onPress={() => setEditing(false)} />
          </Row>
          {update.isError && <ErrorText>{t('Không lưu được, vui lòng thử lại.')}</ErrorText>}
        </View>
      ) : step.result ? (
        <Pressable
          accessibilityRole="button"
          disabled={!active}
          onPress={() => { setDraft(step.result ?? ''); setEditing(true) }}
          style={{ backgroundColor: c.bg, borderRadius: 8, padding: 8 }}
        >
          <Txt style={{ fontSize: 14 }}>
            <Text style={{ fontWeight: '700' }}>{t('Kết quả:')}</Text> {step.result}
          </Txt>
        </Pressable>
      ) : (
        active && <LinkText style={{ fontSize: 14 }} onPress={() => { setDraft(''); setEditing(true) }}>{t('+ Ghi kết quả')}</LinkText>
      )}
    </View>
  )
}
