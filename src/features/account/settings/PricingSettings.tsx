import { t } from '../../../i18n'
import { Card, H2, Muted } from '../../../ui/components'

/** Settings › Pricing: placeholder until plans/billing are built. */
export function PricingSettings() {
  return (
    <Card>
      <H2>{t('Gói dịch vụ')}</H2>
      <Muted>{t('Tính năng này sẽ được phát triển trong các sprint tiếp theo.')}</Muted>
    </Card>
  )
}
