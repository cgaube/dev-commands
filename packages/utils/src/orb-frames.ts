const chars = ' .:-=+*#%@'
const greenColors = [
  '\x1b[38;2;0;30;0m',
  '\x1b[38;2;0;50;0m',
  '\x1b[38;2;0;80;0m',
  '\x1b[38;2;0;120;0m',
  '\x1b[38;2;0;180;0m',
  '\x1b[38;2;50;220;50m',
  '\x1b[38;2;100;255;100m',
  '\x1b[1;32m',
]
const reset = '\x1b[0m'

const frames: string[] = []

export function generatePulseFrame(
  time: number,
  width: number,
  height: number,
): string {
  const lines: string[] = []
  const centerY = height / 2
  const centerX = width / 2
  const radiusX = width / 2
  const radiusY = height / 2

  const sources = [
    { x: Math.sin(time * 0.7) * 0.5, y: Math.cos(time * 0.5) * 0.5 },
    { x: Math.sin(time * 0.9 + 1) * 0.5, y: Math.cos(time * 0.6 + 2) * 0.5 },
    { x: Math.sin(time * 0.5 + 2) * 0.5, y: Math.cos(time * 0.8 + 1) * 0.5 },
    { x: Math.sin(time * 1.1) * 0.3, y: Math.cos(time * 0.4) * 0.3 },
  ]

  for (let y = 0; y < height; y++) {
    let line = ''
    const dy = y - centerY

    for (let x = 0; x < width; x++) {
      const dx = x - centerX
      const dist = Math.sqrt((dx / radiusX) ** 2 + (dy / radiusY) ** 2)

      if (dist > 1) {
        line += ' '
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

      const combined = Math.max(0, Math.min(1, plasma * (1 - dist * 0.7)))

      if (combined < 0.1) {
        line += ' '
        continue
      }

      const charIndex = Math.min(
        Math.floor(combined * chars.length),
        chars.length - 1,
      )
      const colorIndex = Math.min(
        Math.floor(combined * greenColors.length),
        greenColors.length - 1,
      )

      line += greenColors[colorIndex] + chars[charIndex] + reset
    }
    lines.push(line + reset)
  }

  return lines.join('\n')
}

for (let i = 0; i < 48; i++) {
  const t = (i / 48) * Math.PI * 4
  frames.push(generatePulseFrame(t, 80, 20))
}

export const orbFrames = frames
