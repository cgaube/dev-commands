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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeSize(size: number): number {
  return Math.max(2, Math.floor(size))
}

export function generatePulseFrame(
  time: number,
  width: number,
  height: number,
): string {
  const normalizedWidth = normalizeSize(width)
  const normalizedHeight = normalizeSize(height)
  const lines: string[] = []
  const centerY = normalizedHeight / 2
  const centerX = normalizedWidth / 2
  const radiusX = normalizedWidth / 2
  const radiusY = normalizedHeight / 2

  const sources = [
    { x: Math.sin(time * 0.7) * 0.5, y: Math.cos(time * 0.5) * 0.5 },
    { x: Math.sin(time * 0.9 + 1) * 0.5, y: Math.cos(time * 0.6 + 2) * 0.5 },
    { x: Math.sin(time * 0.5 + 2) * 0.5, y: Math.cos(time * 0.8 + 1) * 0.5 },
    { x: Math.sin(time * 1.1) * 0.3, y: Math.cos(time * 0.4) * 0.3 },
  ]

  for (let y = 0; y < normalizedHeight; y++) {
    const line: string[] = []
    const dy = y - centerY

    for (let x = 0; x < normalizedWidth; x++) {
      const dx = x - centerX
      const dist = Math.sqrt((dx / radiusX) ** 2 + (dy / radiusY) ** 2)

      if (dist > 1) {
        line.push(' ')
        continue
      }

      let plasma = 0
      for (const src of sources) {
        const sx = src.x * radiusX
        const sy = src.y * radiusY
        const d = Math.sqrt((dx - sx) ** 2 + (dy - sy) ** 2)
        plasma += Math.sin(d * 0.15 - time * 2) * 0.5 + 0.5
      }
      plasma /= sources.length

      const combined = clamp(plasma * (1 - dist * 0.7), 0, 1)

      if (combined < 0.1) {
        line.push(' ')
        continue
      }

      const charIndex = Math.min(
        Math.floor(combined * CHARS.length),
        CHARS.length - 1,
      )
      const colorIndex = Math.min(
        Math.floor(combined * GREEN_COLORS.length),
        GREEN_COLORS.length - 1,
      )

      line.push(GREEN_COLORS[colorIndex] + CHARS[charIndex] + RESET)
    }
    lines.push(line.join('') + RESET)
  }

  return lines.join('\n')
}

export function generateOrbFrames(
  width = 80,
  height = 20,
  frameCount = DEFAULT_FRAME_COUNT,
): string[] {
  const totalFrames = Math.max(1, Math.floor(frameCount))
  const frames: string[] = []

  for (let i = 0; i < totalFrames; i++) {
    const t = (i / totalFrames) * Math.PI * DEFAULT_CYCLES
    frames.push(generatePulseFrame(t, width, height))
  }

  return frames
}

export const orbFrames = generateOrbFrames()
