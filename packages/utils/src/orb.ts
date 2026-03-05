import { generatePulseFrame } from './orb-frames'

function getTerminalSize() {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  return { cols, rows }
}

function getOrbSize(cols: number, rows: number) {
  const width = Math.floor(cols * 0.35)
  const height = Math.min(30, Math.floor(rows * 0.5))
  return { width, height }
}

export class OrbAnimation {
  private interval: ReturnType<typeof setInterval> | null = null
  private frameIndex = 0
  private frame = ''

  start(callback: () => void) {
    const { cols, rows } = getTerminalSize()
    const { width, height } = getOrbSize(cols, rows)

    const generateFrame = (index: number) => {
      const t = (index / 48) * Math.PI * 4
      const rawFrame = generatePulseFrame(t, width, height)
      const padding = Math.max(0, Math.floor((cols - width) / 2))
      const lines = rawFrame.split('\n')
      return lines.map((line) => ' '.repeat(padding) + line).join('\n')
    }

    const update = () => {
      this.frame = generateFrame(this.frameIndex)
      this.frameIndex++
      callback()
    }

    update()
    this.interval = setInterval(update, 180)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  getFrame(): string {
    return this.frame
  }
}

export function generateOrb(time: number): string {
  const { cols, rows } = getTerminalSize()
  const { width, height } = getOrbSize(cols, rows)
  const t = ((time * 10) / 48) * Math.PI * 4
  const rawFrame = generatePulseFrame(t, width, height)
  const padding = Math.max(0, Math.floor((cols - width) / 2))
  const lines = rawFrame.split('\n')
  return lines.map((line) => ' '.repeat(padding) + line).join('\n')
}
