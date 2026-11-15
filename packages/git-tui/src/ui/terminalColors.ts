// Ask the terminal for its default text and background colors (OSC 10 and
// OSC 11). OpenTUI can also ask, but it first checks for OSC 4 (the palette),
// and some terminals answer OSC 10 and 11 but not OSC 4 (for example Warp).
// Call this before the renderer starts: then nothing else reads stdin.

export type TerminalColors = { fg?: string; bg?: string }

// For example "rgb:3131/3232/3f3f". Each channel has 1 to 4 hex digits.
const COLOR_ANSWER =
  // oxlint-disable-next-line no-control-regex -- terminal answers start with ESC
  /\x1b\](1[01]);rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})(?:\x07|\x1b\\)/gi
// The answer to "device attributes" (DA1), for example "\x1b[?62;22c".
// oxlint-disable-next-line no-control-regex -- terminal answers start with ESC
const DA1_ANSWER = /\x1b\[\?[\d;]*c/

// One channel to two hex digits: "3f3f" and "3f" both give "3f".
function channel(value: string): string {
  const max = 16 ** value.length - 1
  return Math.round((parseInt(value, 16) / max) * 255)
    .toString(16)
    .padStart(2, '0')
}

// Almost all terminals answer DA1, and a terminal answers in order. So when
// the DA1 answer comes, the colors came before it, or never come. The
// timeout is for a terminal that answers nothing.
export function queryTerminalColors(timeoutMs = 500): Promise<TerminalColors> {
  const { stdin, stdout } = process
  if (!stdin.isTTY || !stdout.isTTY) return Promise.resolve({})
  return new Promise((resolve) => {
    const colors: TerminalColors = {}
    let buffer = ''
    const wasRaw = stdin.isRaw
    const finish = () => {
      clearTimeout(timer)
      stdin.off('data', onData)
      stdin.setRawMode(wasRaw)
      stdin.pause()
      resolve(colors)
    }
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('latin1')
      for (const m of buffer.matchAll(COLOR_ANSWER)) {
        const hex = `#${channel(m[2])}${channel(m[3])}${channel(m[4])}`
        if (m[1] === '10') colors.fg = hex
        else colors.bg = hex
      }
      if (DA1_ANSWER.test(buffer)) finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    stdin.setRawMode(true)
    stdin.on('data', onData)
    stdin.resume()
    stdout.write('\x1b]10;?\x07\x1b]11;?\x07\x1b[c')
  })
}
