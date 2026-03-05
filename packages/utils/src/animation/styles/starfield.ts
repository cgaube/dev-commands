import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const starfieldIntensity: StyleIntensityFn = ({
  time,
  nx,
  ny,
  dist,
}) => {
  const nz = Math.sqrt(Math.max(0, 1 - dist * dist))
  const theta = Math.atan2(ny, nx) + time * 0.7
  const radius = dist

  const starSeedA = Math.sin(theta * 37 + radius * 61 - time * 2.1)
  const starSeedB = Math.cos(theta * 53 - radius * 47 + time * 1.6)
  const stars =
    clamp((starSeedA * 0.55 + starSeedB * 0.45) * 0.5 + 0.5, 0, 1) ** 22

  const nebulaA = Math.sin(theta * 4 + radius * 9 + time * 0.5)
  const nebulaB = Math.cos(theta * 7 - radius * 11 - time * 0.8)
  const nebula = clamp((nebulaA * 0.6 + nebulaB * 0.4) * 0.5 + 0.5, 0, 1)

  const shell = Math.exp(-((dist - 0.9) ** 2) / 0.02) * 0.35
  const coreGlow = Math.exp(-(dist ** 2) / 0.2) * 0.16

  const lightX = -0.42
  const lightY = -0.3
  const lightZ = 0.82
  const diffuse = clamp(nx * lightX + ny * lightY + nz * lightZ, 0, 1)

  const space = nebula * 0.35 + stars * 1.1 + shell + coreGlow
  return clamp(space * (0.2 + diffuse * 0.8), 0, 1)
}
