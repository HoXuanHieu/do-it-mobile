import { Bar } from '../../ui/components'
import { useColors } from '../../ui/theme'

/** Budget bar: warn color from the first alert threshold (max 80%), red at/over 100%. */
export function ProgressBar({ percent, thresholds }: { percent: number; thresholds: number[] }) {
  const c = useColors()
  const warn = Math.min(...thresholds.filter((x) => x < 100), 80)
  return <Bar percent={percent} color={percent >= 100 ? c.expense : percent >= warn ? c.warn : c.income} />
}
