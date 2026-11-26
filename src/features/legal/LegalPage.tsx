import { router } from 'expo-router'
import { locale, t } from '../../i18n'
import { H1, H2, LinkText, Muted, SafeScreen, Txt } from '../../ui/components'
import { COPYRIGHT, legalDoc } from './content'

/** Public screen (no login): /privacy or /terms (web: LegalPage). */
export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const d = legalDoc(doc, locale())
  return (
    <SafeScreen>
      <LinkText onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>← {t('Quay lại')}</LinkText>
      <H1>{d.title}</H1>
      <Muted>{d.updated}</Muted>
      {d.sections.map((s) => (
        <Txt key={s.h} style={{ lineHeight: 22 }}>
          <H2>{s.h + '\n'}</H2>
          {s.body.map((b) => (typeof b === 'string' ? b : b.map((li) => `• ${li}`).join('\n'))).join('\n\n')}
        </Txt>
      ))}
      <LegalLinks />
    </SafeScreen>
  )
}

/** "© 2026 DO-IT · Terms · Privacy" footer (auth screens, legal screens, settings). */
export function LegalLinks() {
  return (
    <Muted style={{ textAlign: 'center', fontSize: 12 }}>
      {COPYRIGHT} · <LinkText style={{ fontSize: 12 }} onPress={() => router.push('/terms')}>{t('Điều khoản sử dụng')}</LinkText> ·{' '}
      <LinkText style={{ fontSize: 12 }} onPress={() => router.push('/privacy')}>{t('Chính sách quyền riêng tư')}</LinkText>
    </Muted>
  )
}
