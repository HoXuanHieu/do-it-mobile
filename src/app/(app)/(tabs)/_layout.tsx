import { router } from 'expo-router'
import { Tabs } from 'expo-router/tabs'
import { Image, Pressable, Text, View } from 'react-native'
import { t, type Key } from '../../../i18n'
import { useAvatarUrl, useProfile } from '../../../features/account/queries'
import { useAuth } from '../../../features/auth/AuthContext'
import { useUnreadCount } from '../../../features/notifications/queries'
import { Icon, type IconName } from '../../../ui/components'
import { useColors } from '../../../ui/theme'

const TABS: { name: string; label: Key; icon: IconName }[] = [
  { name: 'index', label: 'Tổng quan', icon: 'home' },
  { name: 'calendar', label: 'Lịch & Sự kiện', icon: 'calendar' },
  { name: 'health', label: 'Sức khỏe', icon: 'health' },
  { name: 'finance', label: 'Tài chính', icon: 'finance' },
  { name: 'goals', label: 'Mục tiêu', icon: 'goals' },
]

/** Bottom tabs = web sidebar modules; notifications / settings / profile sit in the header. */
export default function TabsLayout() {
  const c = useColors()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        sceneStyle: { backgroundColor: c.bg },
        headerRight: () => <HeaderActions />,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarLabel: t(tab.label).split(' & ')[0], // "Lịch & Sự kiện" is too long for a tab label
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  )
}

function HeaderActions() {
  const c = useColors()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const avatarUrl = useAvatarUrl(profile)
  const count = useUnreadCount().data?.count ?? 0
  const name = user?.fullName ?? user?.email ?? ''
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 14 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Thông báo')} onPress={() => router.push('/notifications')} hitSlop={8}>
        <Icon name="bell" color={c.text} />
        {count > 0 && (
          <View accessibilityLabel={t('{count} chưa đọc', { count })} style={{ position: 'absolute', top: -6, right: -8, backgroundColor: c.danger, borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Cài đặt')} onPress={() => router.push('/settings')} hitSlop={8}>
        <Icon name="settings" color={c.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={user?.email} onPress={() => router.push('/profile')} hitSlop={8}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: 30, height: 30 }} /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>}
        </View>
      </Pressable>
    </View>
  )
}
