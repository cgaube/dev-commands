import {
  generateOrbFrame,
  pickRandomOrbStyle,
  type OrbStyle,
} from './orb-frame-generator'

const FRAME_COUNT = 48
const FRAME_CYCLES = 4
const FRAME_INTERVAL_MS = 250
const ORB_WIDTH_RATIO = 0.35
const ORB_HEIGHT_RATIO = 0.5
const MIN_ORB_WIDTH = 20
const MIN_ORB_HEIGHT = 8
const MAX_ORB_HEIGHT = 30

function getTerminalSize() {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  return { cols, rows }
}

function getOrbSize(cols: number, rows: number) {
  const width = Math.max(MIN_ORB_WIDTH, Math.floor(cols * ORB_WIDTH_RATIO))
  const height = Math.max(
    MIN_ORB_HEIGHT,
    Math.min(MAX_ORB_HEIGHT, Math.floor(rows * ORB_HEIGHT_RATIO)),
  )
  return { width, height }
}

export class OrbAnimation {
  private interval: ReturnType<typeof setInterval> | null = null
  private frameIndex = 0
  private frame = ''

  constructor(private readonly style: OrbStyle = pickRandomOrbStyle()) {}

  start(callback: () => void) {
    this.stop()
    this.frameIndex = 0

    const generateFrame = (index: number, cols: number, rows: number) => {
      const { width, height } = getOrbSize(cols, rows)
      const t = ((index % FRAME_COUNT) / FRAME_COUNT) * Math.PI * FRAME_CYCLES
      const rawFrame = generateOrbFrame(t, width, height, this.style)
      const padding = Math.max(0, Math.floor((cols - width) / 2))
      const horizontalPadding = ' '.repeat(padding)
      const lines = rawFrame.split('\n')
      return lines.map((line) => horizontalPadding + line).join('\n')
    }

    const update = () => {
      const { cols, rows } = getTerminalSize()
      this.frame = generateFrame(this.frameIndex, cols, rows)
      this.frameIndex++
      callback()
    }

    update()
    this.interval = setInterval(update, FRAME_INTERVAL_MS)
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

export function generateOrb(
  time: number,
  style: OrbStyle = pickRandomOrbStyle(),
): string {
  const { cols, rows } = getTerminalSize()
  const { width, height } = getOrbSize(cols, rows)
  const t = ((time * 10) / FRAME_COUNT) * Math.PI * FRAME_CYCLES
  const rawFrame = generateOrbFrame(t, width, height, style)
  const padding = Math.max(0, Math.floor((cols - width) / 2))
  const horizontalPadding = ' '.repeat(padding)
  const lines = rawFrame.split('\n')
  return lines.map((line) => horizontalPadding + line).join('\n')
}

export type { OrbStyle } from './orb-frame-generator'
export { isOrbStyle, ORB_STYLES, pickRandomOrbStyle } from './orb-frame-generator'
