import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { t, type Key } from '../../i18n'
import { Button, Screen, Segmented } from '../../ui/components'
import { useAuth } from '../auth/AuthContext'
import { LegalLinks } from '../legal/LegalPage'
import { AccountSettings } from './settings/AccountSettings'
import { AppearanceSettings } from './settings/AppearanceSettings'
import { PricingSettings } from './settings/PricingSettings'

const TABS = [
  { value: 'account', label: 'Tài khoản' as Key, Component: AccountSettings },
  { value: 'appearance', label: 'Giao diện' as Key, Component: AppearanceSettings },
  { value: 'pricing', label: 'Gói dịch vụ' as Key, Component: PricingSettings },
]

/** Settings page. Route: /settings?tab=account|appearance|pricing. Logout lives here (web had it in the sidebar footer). */
export function SettingsPage() {
  const { tab } = useLocalSearchParams<{ tab?: string }>()
  const { logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const current = TABS.find((x) => x.value === tab) ?? TABS[0]

  return (
    <Screen>
      <Segmented value={current.value} options={TABS.map((x) => ({ value: x.value, label: t(x.label) }))} onChange={(v) => router.setParams({ tab: v })} />
      <current.Component />
      <Button
        variant="danger"
        title={t('Đăng xuất')}
        busy={loggingOut}
        style={{ marginTop: 12 }}
        onPress={() => {
          setLoggingOut(true)
          void logout().finally(() => setLoggingOut(false))
        }}
      />
      <LegalLinks />
    </Screen>
  )
}
