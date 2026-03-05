import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const rollingEyeIntensity: StyleIntensityFn = ({ time, nx, ny, dist }) => {
  const nz = Math.sqrt(Math.max(0, 1 - dist * dist))

  const rollX = Math.sin(time * 0.75) * 0.22
  const rollY = Math.cos(time * 0.55) * 0.14
  const rx = nx - rollX
  const ry = ny - rollY
  const irisDist = Math.sqrt(rx * rx + ry * ry)
  const angle = Math.atan2(ry, rx)

  const ringA = Math.exp(-((irisDist - 0.52) ** 2) / 0.022)
  const ringB = Math.exp(-((irisDist - 0.72) ** 2) / 0.03) * 0.65
  const centerHaze = Math.exp(-(irisDist ** 2) / 0.12) * 0.4
  const irisMask = clamp(ringA + ringB + centerHaze, 0, 1)

  const fiberA = Math.sin(angle * 16 + irisDist * 22 - time * 1.1)
  const fiberB = Math.cos(angle * 11 - irisDist * 17 + time * 0.8)
  const flow = clamp((fiberA * 0.55 + fiberB * 0.45) * 0.5 + 0.5, 0, 1)

  const lightX = -0.45
  const lightY = -0.28
  const lightZ = 0.82
  const diffuse = clamp(nx * lightX + ny * lightY + nz * lightZ, 0, 1)
  const rim = Math.exp(-((dist - 0.97) ** 2) / 0.0018) * 0.42
  const sclera = (1 - irisMask) * 0.11 * (0.45 + diffuse * 0.55)

  const iris = irisMask * (0.28 + diffuse * 0.72) * (0.45 + flow * 0.55)
  return clamp(sclera + iris + rim, 0, 1)
}
