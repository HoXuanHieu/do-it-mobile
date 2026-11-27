import { router } from 'expo-router'
import { Tabs } from 'expo-router/tabs'
import { Image, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleAlign: 'left', // centered long titles ("Calendar & Events") run under the header icons on iOS
        headerTitleStyle: { fontSize: 18, fontWeight: '800' },
        // floating glass pill, kept in layout flow so screens/FABs need no extra bottom padding
        tabBarStyle: {
          marginHorizontal: 14,
          marginBottom: insets.bottom + 8,
          height: 64,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 6,
          borderRadius: 32,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: c.glassBorder,
          backgroundColor: c.surface,
          elevation: 0,
          ...(Platform.OS === 'ios' ? { shadowColor: '#0b3a4a', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } } : {}),
        },
        // the active background is painted on an inner square pressable; clip it to the rounded item
        tabBarItemStyle: { borderRadius: 26, overflow: 'hidden' },
        tabBarActiveBackgroundColor: c.pill,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        sceneStyle: { backgroundColor: 'transparent' },
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
