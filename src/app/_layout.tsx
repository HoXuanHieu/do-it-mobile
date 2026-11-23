import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '../features/auth/AuthContext'
import { initLanguage, useLanguage } from '../i18n'
import { Loading } from '../ui/components'
import { useIsDark } from '../ui/theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void initLanguage().finally(() => setReady(true)) // stored language before first paint
  }, [])
  if (!ready) return <Loading />
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

function Root() {
  const lang = useLanguage()
  const dark = useIsDark()
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* keyed so every t() call re-renders when the language changes */}
      <Stack key={lang} screenOptions={{ headerShown: false }} />
    </>
  )
}
