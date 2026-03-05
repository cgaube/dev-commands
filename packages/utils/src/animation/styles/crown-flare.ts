import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const crownFlareIntensity: StyleIntensityFn = ({
  time,
  nx,
  ny,
  dist,
}) => {
  const nz = Math.sqrt(Math.max(0, 1 - dist * dist))
  const theta = Math.atan2(ny, nx)

  const rimMask = Math.exp(-((dist - 0.9) ** 2) / 0.012)
  const crownSpikeA = Math.abs(Math.sin(theta * 7 + time * 1.4)) ** 12
  const crownSpikeB = Math.abs(Math.sin(theta * 11 - time * 1.0 + 0.8)) ** 14
  const crown = rimMask * (crownSpikeA * 0.8 + crownSpikeB * 0.7)

  const innerWaveA = Math.sin(theta * 4 + dist * 8 - time * 0.8)
  const innerWaveB = Math.cos(theta * 6 - dist * 10 + time * 0.55)
  const innerFlow = clamp(
    (innerWaveA * 0.55 + innerWaveB * 0.45) * 0.5 + 0.5,
    0,
    1,
  )

  const lightX = -0.52
  const lightY = -0.3
  const lightZ = 0.8
  const diffuse = clamp(nx * lightX + ny * lightY + nz * lightZ, 0, 1)

  const coreGlow = Math.exp(-(dist ** 2) / 0.2) * 0.2
  const rim = Math.exp(-((dist - 0.97) ** 2) / 0.0019) * 0.42

  const base = innerFlow * (0.22 + diffuse * 0.55) + coreGlow
  return clamp(base + crown * (0.35 + diffuse * 0.65) + rim, 0, 1)
}
