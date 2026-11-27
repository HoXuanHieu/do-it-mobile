import { StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useIsDark } from './theme'

// Sky → glow → layered hills; light = morning, dark = night. Sits behind every navigator (they are transparent).
const PALETTE = {
  light: { sky: ['#cfe8f3', '#fdf1dc', '#f9dcc0', '#9fd3d8'], glow: '#fff3c4', hills: ['#a9d6d8', '#5aa7b0', '#2f7f8c'] },
  dark: { sky: ['#0d1b2a', '#16263b', '#1a2f45', '#0f3b44'], glow: '#7f9cff', hills: ['#21495a', '#183c4a', '#0f2c36'] },
}

export function Backdrop() {
  const p = PALETTE[useIsDark() ? 'dark' : 'light']
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" pointerEvents="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.sky[0]} />
          <Stop offset="0.45" stopColor={p.sky[1]} />
          <Stop offset="0.7" stopColor={p.sky[2]} />
          <Stop offset="1" stopColor={p.sky[3]} />
        </LinearGradient>
        <RadialGradient id="glow" cx="130" cy="260" r="170" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={p.glow} stopOpacity="0.9" />
          <Stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="400" height="800" fill="url(#sky)" />
      <Rect width="400" height="800" fill="url(#glow)" />
      <Path d="M0 560 C60 500 110 520 160 480 C210 440 260 500 310 470 C350 450 380 480 400 470 L400 800 L0 800 Z" fill={p.hills[0]} opacity={0.7} />
      <Path d="M0 620 C50 580 100 600 150 570 C200 540 240 590 290 575 C340 560 370 600 400 590 L400 800 L0 800 Z" fill={p.hills[1]} opacity={0.85} />
      <Path d="M0 690 C70 660 130 700 200 675 C270 650 330 690 400 670 L400 800 L0 800 Z" fill={p.hills[2]} />
      <Path d="M0 730 C80 710 160 750 240 725 C300 708 360 735 400 720" stroke="#fff" strokeOpacity={0.22} strokeWidth={2} fill="none" />
      <Path d="M0 765 C90 745 170 780 260 758 C320 744 370 765 400 755" stroke="#fff" strokeOpacity={0.15} strokeWidth={2} fill="none" />
    </Svg>
  )
}
