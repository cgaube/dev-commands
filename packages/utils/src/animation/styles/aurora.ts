import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const auroraIntensity: StyleIntensityFn = ({ time, nx, ny, dist }) => {
  const waveA = Math.sin(nx * 3 + time * 0.8) * 0.28
  const waveB = Math.sin(nx * 4 - time * 0.6 + 2) * 0.2
  const bandA = Math.exp(-((ny - waveA) ** 2) / 0.03)
  const bandB = Math.exp(-((ny - waveB) ** 2) / 0.02)
  const base = Math.exp(-(dist ** 2) / 0.55) * 0.15
  const bands = (bandA * 0.75 + bandB * 0.55) * (1 - dist * 0.5)
  return clamp(base + bands, 0, 1)
}
