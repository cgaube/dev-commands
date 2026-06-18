import type { OrbAnimation } from './orb-animation'

// Thin, named wrappers around the terminal control codes so the intent is
// obvious without memorising escape sequences.
const term = {
  // Switch to a clean fullscreen page (the old terminal contents are hidden).
  enterFullscreen: () => process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H'),
  // Return to the normal page, restoring whatever was there before.
  exitFullscreen: () => process.stdout.write('\x1b[?1049l'),
  hideCursor: () => process.stdout.write('\x1b[?25l'),
  showCursor: () => process.stdout.write('\x1b[?25h'),
  // Draw one frame wrapped in a synchronized update (begin…end) so the terminal
  // swaps it in one go — and, crucially, so we never leave the terminal stuck
  // mid-update, which is what previously left the screen blank.
  drawFrame: (content: string) =>
    process.stdout.write('\x1b[?2026h\x1b[H' + content + '\x1b[?2026l'),
}

// Lay the orb out vertically centered with the status text pinned to the
// bottom, returning the full screen as a single string.
function composeFrame(orbFrame: string, statusLines: string[]): string {
  const usableRows = Math.max(1, process.stdout.rows || 24)
  const orbLines = orbFrame.split('\n')
  const screenLines = Array.from({ length: usableRows }, () => '')

  const topPadding = Math.max(
    0,
    Math.floor((usableRows - orbLines.length) / 2) - 2,
  )
  orbLines.forEach((line, i) => {
    if (topPadding + i < usableRows) screenLines[topPadding + i] = line
  })

  const statusStart = Math.max(0, usableRows - statusLines.length)
  statusLines.forEach((line, i) => {
    if (statusStart + i < usableRows) screenLines[statusStart + i] = line
  })

  return screenLines.map((l) => l + '\x1b[K').join('\n') + '\x1b[J'
}

export type OrbSession = {
  // Resolves when the user cancels with Ctrl+C (the session also tears itself
  // down in that case).
  cancelled: Promise<void>
  // Tear down the fullscreen view and restore the terminal. Idempotent.
  close: () => void
}

// Show the orb on the alternate (fullscreen) screen: animate for `animateMs`,
// then freeze on the last frame and simply leave it there. No repaint loop is
// needed — the terminal preserves and redraws the alternate screen on its own
// (the same reason vim/htop survive a sleep/wake). The only repaint we drive is
// on resize, which is an event, not a poll.
export function runFullscreenOrb(
  orb: OrbAnimation,
  statusLines: string[],
  animateMs: number,
): OrbSession {
  const isTTY = process.stdin.isTTY
  let closed = false
  let freezeTimer: ReturnType<typeof setTimeout> | undefined

  let resolveCancelled!: () => void
  const cancelled = new Promise<void>((resolve) => {
    resolveCancelled = resolve
  })

  const draw = () => term.drawFrame(composeFrame(orb.getFrame(), statusLines))
  const onResize = () => draw()
  const onData = (data: Buffer) => {
    if (data[0] === 3) resolveCancelled() // Ctrl+C arrives as a raw byte
  }
  const onSigint = () => resolveCancelled() // covers non-TTY where it's a signal

  const close = () => {
    if (closed) return
    closed = true
    clearTimeout(freezeTimer)
    orb.stop()
    process.off('SIGWINCH', onResize)
    process.off('SIGINT', onSigint)
    process.stdin.off('data', onData)
    if (isTTY) {
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    term.showCursor()
    term.exitFullscreen()
  }

  // Tear down as soon as the user cancels, before the caller reacts.
  void cancelled.then(close)

  term.enterFullscreen()
  term.hideCursor()
  process.on('SIGWINCH', onResize)
  process.on('SIGINT', onSigint)
  if (isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  }

  orb.start(draw)
  // animateMs === Infinity means "animate forever" (--animation-timeout 0);
  // setTimeout would treat that as 0, so only schedule the freeze for a finite
  // duration. Freezing is just "stop advancing frames" — the last one stays.
  if (Number.isFinite(animateMs)) {
    freezeTimer = setTimeout(() => orb.stop(), animateMs)
  }

  return { cancelled, close }
}
