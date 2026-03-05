import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const stormCoreIntensity: StyleIntensityFn = ({
  time,
  nx,
  ny,
  dist,
}) => {
  const nz = Math.sqrt(Math.max(0, 1 - dist * dist))
  const theta = Math.atan2(ny, nx)

  const vortexA = Math.sin(theta * 6 + dist * 14 - time * 1.4)
  const vortexB = Math.cos(theta * 11 - dist * 18 + time * 1.1)
  const turbulence = clamp((vortexA * 0.55 + vortexB * 0.45) * 0.5 + 0.5, 0, 1)

  const core = Math.exp(-(dist ** 2) / 0.09)
  const ring = Math.exp(-((dist - 0.42) ** 2) / 0.016) * 0.6
  const filaments =
    Math.abs(Math.sin(theta * 13 + time * 2.2 - dist * 10)) ** 18

  const lightX = -0.5
  const lightY = -0.25
  const lightZ = 0.8
  const diffuse = clamp(nx * lightX + ny * lightY + nz * lightZ, 0, 1)
  const rim = Math.exp(-((dist - 0.97) ** 2) / 0.0018) * 0.45

  const storm =
    (core * 0.75 + ring + filaments * 0.45) * (0.5 + turbulence * 0.5)
  return clamp(storm * (0.22 + diffuse * 0.78) + rim, 0, 1)
}
