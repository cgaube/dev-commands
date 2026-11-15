import type { CliRenderer } from '@opentui/core'
import { run } from '#src/data/exec'

// Put text on the clipboard. On a local Mac, pbcopy always works. Else (an
// SSH session, Linux) ask the terminal with OSC 52. The terminal must allow
// it, for example iTerm2 "Applications in terminal may access clipboard",
// or `set-clipboard on` in tmux.
export async function copyText(
  renderer: CliRenderer,
  text: string,
): Promise<void> {
  const ssh = process.env.SSH_TTY || process.env.SSH_CONNECTION
  if (process.platform === 'darwin' && !ssh) {
    await run('pbcopy', [], { input: text })
    return
  }
  if (!renderer.copyToClipboardOSC52(text)) {
    throw new Error('this terminal cannot copy (no OSC 52)')
  }
}
