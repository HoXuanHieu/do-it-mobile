import { Redirect, Stack } from 'expo-router'
import { t } from '../../i18n'
import { useAuth } from '../../features/auth/AuthContext'
import { useLanguageSync } from '../../features/account/queries'
import { MedicationReminderPopup } from '../../features/health/MedicationReminder'
import { Loading } from '../../ui/components'
import { useColors } from '../../ui/theme'

/** Authenticated shell (web AppLayout): guards routes, syncs language, shows the medication reminder. */
export default function AppLayout() {
  const { status } = useAuth()
  if (status === 'loading') return <Loading />
  if (status === 'anonymous') return <Redirect href="/login" />
  return <Shell />
}

function Shell() {
  const c = useColors()
  useLanguageSync()
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.bg },
          headerBackTitle: t('Quay lại'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: t('Thông báo') }} />
        <Stack.Screen name="settings" options={{ title: t('Cài đặt') }} />
        <Stack.Screen name="profile" options={{ title: t('Hồ sơ cá nhân') }} />
        <Stack.Screen name="goals/[id]" options={{ title: t('Mục tiêu') }} />
        <Stack.Screen name="health/[id]" options={{ title: t('Sức khỏe') }} />
      </Stack>
      <MedicationReminderPopup />
    </>
  )
}
