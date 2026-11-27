import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text } from 'react-native'
import { locale, t } from '../../i18n'
import { Button, Card, ErrorText, H2, Loading, Muted, RowBetween, Screen, Segmented, Txt } from '../../ui/components'
import type { HealthProfileDto } from './api'
import { MedicationTab } from './MedicationReminder'
import { BmiPill } from './parts'
import { ProfileFormDialog } from './ProfileFormDialog'
import { GOALS, labelOf, num, useHealthProfiles } from './queries'

export function Disclaimer() {
  return <Muted style={{ fontSize: 12 }}>ⓘ {t('DO-IT không cung cấp chẩn đoán y tế. Các chỉ số chỉ mang tính ước tính tham khảo.')}</Muted>
}

/** Health tab: the user's health profiles (self, family members). */
export function HealthPage() {
  const { data: profiles, isPending, isError } = useHealthProfiles()
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'profiles' | 'meds'>('profiles')

  return (
    <Screen>
      <RowBetween style={{ alignItems: 'flex-start' }}>
        <Muted style={{ flex: 1 }}>{t('Mỗi hồ sơ có đánh giá, thực đơn, lịch tập và theo dõi chỉ số riêng.')}</Muted>
        <Button small title={t('+ Hồ sơ mới')} onPress={() => setCreating(true)} />
      </RowBetween>

      <Segmented value={tab} onChange={setTab} options={[{ value: 'profiles', label: t('Hồ sơ') }, { value: 'meds', label: t('Nhắc uống thuốc') }]} />

      {tab === 'meds' ? (
        <MedicationTab />
      ) : (
        <>
        {isPending && <Loading />}
        {isError && <ErrorText>{t('Không tải được hồ sơ sức khỏe.')}</ErrorText>}

        {profiles?.length === 0 && (
          <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 40 }}>🩺</Text>
            <H2 style={{ textAlign: 'center' }}>{t('Tạo hồ sơ sức khỏe đầu tiên')}</H2>
            <Muted style={{ textAlign: 'center' }}>{t('Nhập chiều cao, cân nặng, mức vận động và mục tiêu để nhận đánh giá, gợi ý ăn uống và lịch tập phù hợp.')}</Muted>
            <Button title={t('Tạo hồ sơ')} onPress={() => setCreating(true)} />
          </Card>
        )}

        {profiles?.map((p) => <ProfileCard key={p.id} p={p} />)}
        </>
      )}

      <Disclaimer />
      <ProfileFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(p) => router.push(`/health/${p.id}`)} />
    </Screen>
  )
}

function ProfileCard({ p }: { p: HealthProfileDto }) {
  const a = p.assessment
  const goal = GOALS.find((g) => g.value === p.goal)!
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(`/health/${p.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={{ gap: 6 }}>
        <RowBetween>
          <H2 style={{ flex: 1 }} numberOfLines={1}>{p.name}</H2>
          <BmiPill cat={a.bmiCategory} bmi={a.bmi} />
        </RowBetween>
        <Muted>{t('{age} tuổi', { age: a.age })} · {num(p.heightCm)} cm · {num(p.weightKg)} kg</Muted>
        <Txt>
          {goal.icon} {t(labelOf(GOALS, p.goal))} · <Txt style={{ fontWeight: '700' }}>{a.dailyCalories}</Txt> {t('kcal/ngày')}
        </Txt>
        {p.nextCheckInAt && (
          <Muted style={{ fontSize: 12 }}>🔔 {t('Đo lại vào {date}', { date: new Date(p.nextCheckInAt).toLocaleDateString(locale()) })}</Muted>
        )}
      </Card>
    </Pressable>
  )
}
