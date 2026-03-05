import { auroraIntensity } from './styles/aurora'
import { haloIntensity } from './styles/halo'
import { plasmaIntensity } from './styles/plasma'
import { rollingEyeIntensity } from './styles/rolling-eye'
import { starfieldIntensity } from './styles/starfield'
import { stormCoreIntensity } from './styles/storm-core'
import type { StyleIntensityFn } from './styles/types'

const CHARS = ' .:-=+*#%@'
const GREEN_COLORS = [
  '\x1b[38;2;0;30;0m',
  '\x1b[38;2;0;50;0m',
  '\x1b[38;2;0;80;0m',
  '\x1b[38;2;0;120;0m',
  '\x1b[38;2;0;180;0m',
  '\x1b[38;2;50;220;50m',
  '\x1b[38;2;100;255;100m',
  '\x1b[1;32m',
]
const RESET = '\x1b[0m'
const DEFAULT_FRAME_COUNT = 48
const DEFAULT_CYCLES = 4

export const ORB_STYLES = [
  'plasma',
  'rolling-eye',
  'storm-core',
  'starfield',
  'halo',
  'aurora',
] as const
export type OrbStyle = (typeof ORB_STYLES)[number]

const STYLE_INTENSITY_MAP: Record<OrbStyle, StyleIntensityFn> = {
  plasma: plasmaIntensity,
  'rolling-eye': rollingEyeIntensity,
  'storm-core': stormCoreIntensity,
  starfield: starfieldIntensity,
  halo: haloIntensity,
  aurora: auroraIntensity,
}

function normalizeSize(size: number): number {
  return Math.max(2, Math.floor(size))
}

function renderPoint(combined: number): string {
  if (combined < 0.08) {
    return ' '
  }

  const charIndex = Math.min(
    Math.floor(combined * CHARS.length),
    CHARS.length - 1,
  )
  const colorIndex = Math.min(
    Math.floor(combined * GREEN_COLORS.length),
    GREEN_COLORS.length - 1,
  )

  return GREEN_COLORS[colorIndex] + CHARS[charIndex] + RESET
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length)
}

export function isOrbStyle(value: string): value is OrbStyle {
  return (ORB_STYLES as readonly string[]).includes(value)
}

export function pickRandomOrbStyle(): OrbStyle {
  return ORB_STYLES[randomIndex(ORB_STYLES.length)]
}

export function generateOrbFrame(
  time: number,
  width: number,
  height: number,
  style: OrbStyle = 'plasma',
): string {
  const normalizedWidth = normalizeSize(width)
  const normalizedHeight = normalizeSize(height)
  const lines: string[] = []
  const centerY = normalizedHeight / 2
  const centerX = normalizedWidth / 2
  const radiusX = normalizedWidth / 2
  const radiusY = normalizedHeight / 2
  const intensityForStyle = STYLE_INTENSITY_MAP[style]

  for (let y = 0; y < normalizedHeight; y++) {
    const line: string[] = []
    const dy = y - centerY

    for (let x = 0; x < normalizedWidth; x++) {
      const dx = x - centerX
      const dist = Math.sqrt((dx / radiusX) ** 2 + (dy / radiusY) ** 2)
      const nx = dx / radiusX
      const ny = dy / radiusY

      if (dist > 1) {
        line.push(' ')
        continue
      }

      const combined = intensityForStyle({
        time,
        dx,
        dy,
        nx,
        ny,
        dist,
        radiusX,
        radiusY,
      })
      line.push(renderPoint(combined))
    }
    lines.push(line.join('') + RESET)
  }

  return lines.join('\n')
}

export function generateOrbFrames(
  width = 80,
  height = 20,
  frameCount = DEFAULT_FRAME_COUNT,
  style: OrbStyle = 'plasma',
): string[] {
  const totalFrames = Math.max(1, Math.floor(frameCount))
  const frames: string[] = []

  for (let i = 0; i < totalFrames; i++) {
    const t = (i / totalFrames) * Math.PI * DEFAULT_CYCLES
    frames.push(generateOrbFrame(t, width, height, style))
  }

  return frames
}

export function generatePulseFrame(
  time: number,
  width: number,
  height: number,
): string {
  return generateOrbFrame(time, width, height, 'plasma')
}

export const orbFrames = generateOrbFrames()
