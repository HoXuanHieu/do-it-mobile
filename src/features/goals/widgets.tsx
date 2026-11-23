import { Text, View } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { t } from '../../i18n'
import { useColors } from '../../ui/theme'
import type { GoalDto, GoalPeriod } from './api'
import { daysLeft } from './queries'

/** Circular progress with the percentage in the middle. `color` overrides the ring/text color (e.g. white on a hero card). */
export function ProgressRing({ percent, size, color }: { percent: number; size: number; color?: string }) {
  const c = useColors()
  const fg = color ?? c.primary
  const r = 42
  const len = 2 * Math.PI * r
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel={t('Tiến độ {p}%', { p: percent })}>
      <Circle cx={50} cy={50} r={r} fill="none" strokeWidth={9} stroke={fg} strokeOpacity={0.16} />
      <Circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        strokeWidth={9}
        stroke={fg}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - percent / 100)}
        transform="rotate(-90 50 50)"
      />
      <SvgText x={50} y={58} textAnchor="middle" fontSize={22} fontWeight="800" fill={color ?? c.text}>
        {`${percent}%`}
      </SvgText>
    </Svg>
  )
}

/** Status / deadline pill: completed, paused, overdue, due soon. */
export function DueBadge({ goal }: { goal: GoalDto }) {
  const c = useColors()
  const pill = (label: string, fg: string, bg: string) => (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  )
  if (goal.status === 'Completed') return pill(t('🎉 Hoàn thành'), c.success, c.successBg)
  if (goal.status === 'Abandoned') return pill(t('Tạm dừng'), c.muted, c.border)
  const d = daysLeft(goal)
  const fg = d < 0 ? c.danger : d <= 3 ? c.warn : c.muted
  return pill(d < 0 ? t('Quá hạn {n} ngày', { n: -d }) : d === 0 ? t('Hạn hôm nay') : t('Còn {n} ngày', { n: d }), fg, c.border)
}

/** Accent color per period (web --c-day … --c-year; the web gradients become this solid color). */
export const PERIOD_COLOR: Record<GoalPeriod, string> = { Day: '#f2622e', Week: '#1d84d8', Month: '#6d5efc', Year: '#0f9f8f' }
