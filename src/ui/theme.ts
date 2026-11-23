import { useColorScheme } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { preferencesApi } from '../features/account/api'
import { keys } from '../features/account/queries'
import { useAuth } from '../features/auth/AuthContext'

// Same palette as frontend/src/index.css (+ styles/finance.css income/expense/warn).
const light = {
  bg: '#f6f7f9',
  surface: '#ffffff',
  text: '#1b1f24',
  muted: '#5d6673',
  border: '#e2e5ea',
  primary: '#2f6fed',
  danger: '#c62828',
  success: '#2e7d32',
  successBg: '#e8f5e9',
  unreadBg: '#eef3fe',
  income: '#2f9e44',
  expense: '#e03131',
  warn: '#e67700',
}

const dark: typeof light = {
  bg: '#111418',
  surface: '#1a1e24',
  text: '#e7eaee',
  muted: '#9aa3ae',
  border: '#2b313a',
  primary: '#5b8ff9',
  danger: '#ef6b6b',
  success: '#4caf7d',
  successBg: '#17301f',
  unreadBg: '#1c2638',
  income: '#51cf66',
  expense: '#ff6b6b',
  warn: '#ffa94d',
}

export type Colors = typeof light

/** Event category colors (--cat-* in index.css). */
export const CATEGORY_COLOR: Record<string, string> = {
  Work: '#2f6fed',
  Personal: '#8e44ad',
  Meeting: '#e67700',
  Health: '#2f9e44',
  Study: '#0c8599',
  Other: '#6c757d',
}

/** Theme preference (FR-SH-004): "System" follows the OS; signed out = OS theme. */
export function useIsDark() {
  const os = useColorScheme()
  const signedIn = useAuth().status === 'authenticated'
  const pref = useQuery({ queryKey: keys.preferences, queryFn: preferencesApi.get, enabled: signedIn }).data?.theme
  return pref === 'Dark' || (pref !== 'Light' && os === 'dark')
}

export function useColors(): Colors {
  return useIsDark() ? dark : light
}

export const RADIUS = 10
