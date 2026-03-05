import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const haloIntensity: StyleIntensityFn = ({ time, dist }) => {
  const breathe = 0.5 + 0.5 * Math.sin(time * 0.9)
  const rim = Math.exp(-((dist - 0.8) ** 2) / 0.02)
  const core = Math.exp(-(dist ** 2) / 0.2) * 0.3
  return clamp(rim * (0.55 + breathe * 0.45) + core, 0, 1)
}
