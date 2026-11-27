import { useColorScheme } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { preferencesApi } from '../features/account/api'
import { keys } from '../features/account/queries'
import { useAuth } from '../features/auth/AuthContext'

// Same palette as frontend/src/index.css (+ styles/finance.css income/expense/warn).
// bg/surface are translucent "glass" over the Backdrop; sheet/headerBg stay opaque.
const light = {
  bg: 'rgba(255,255,255,0.45)',
  surface: 'rgba(255,255,255,0.72)',
  sheet: '#ffffff',
  headerBg: '#cfe8f3',
  glassBorder: 'rgba(255,255,255,0.85)',
  pill: 'rgba(255,255,255,0.95)',
  text: '#16232b',
  muted: '#4f5d68',
  border: 'rgba(20,70,90,0.15)',
  primary: '#1d7c8f',
  danger: '#c62828',
  success: '#2e7d32',
  successBg: '#e8f5e9',
  unreadBg: '#eef3fe',
  income: '#2f9e44',
  expense: '#e03131',
  warn: '#e67700',
}

const dark: typeof light = {
  bg: 'rgba(255,255,255,0.05)',
  surface: 'rgba(20,30,42,0.72)',
  sheet: '#18222e',
  headerBg: '#0d1b2a',
  glassBorder: 'rgba(255,255,255,0.10)',
  pill: 'rgba(255,255,255,0.14)',
  text: '#e7eef2',
  muted: '#a3b0ba',
  border: 'rgba(255,255,255,0.14)',
  primary: '#4fb8c9',
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

export const RADIUS = 20
