import { clamp } from './math'
import type { StyleIntensityFn } from './types'

export const plasmaIntensity: StyleIntensityFn = ({
  time,
  dx,
  dy,
  dist,
  radiusX,
  radiusY,
}) => {
  const sources = [
    { x: Math.sin(time * 0.7) * 0.5, y: Math.cos(time * 0.5) * 0.5 },
    { x: Math.sin(time * 0.9 + 1) * 0.5, y: Math.cos(time * 0.6 + 2) * 0.5 },
    { x: Math.sin(time * 0.5 + 2) * 0.5, y: Math.cos(time * 0.8 + 1) * 0.5 },
    { x: Math.sin(time * 1.1) * 0.3, y: Math.cos(time * 0.4) * 0.3 },
  ]

  let plasma = 0
  for (const src of sources) {
    const sx = src.x * radiusX
    const sy = src.y * radiusY
    const distance = Math.sqrt((dx - sx) ** 2 + (dy - sy) ** 2)
    plasma += Math.sin(distance * 0.15 - time * 2) * 0.5 + 0.5
  }
  plasma /= sources.length

  return clamp(plasma * (1 - dist * 0.7), 0, 1)
}
