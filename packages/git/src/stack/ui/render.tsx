import { render } from 'ink'
import { App } from './App'

// Launch the stack TUI inside the terminal's alternate screen buffer so the
// full-screen UI doesn't clobber the user's scrollback, restoring it on exit.
export async function renderStackApp(): Promise<void> {
  process.stdout.write('\x1b[?1049h\x1b[H')
  const instance = render(<App />)
  try {
    await instance.waitUntilExit()
  } finally {
    process.stdout.write('\x1b[?1049l')
  }
}
