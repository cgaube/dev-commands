import { render } from 'ink'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './components/App'
import { queryClient } from './query/client'

// Launch the stack TUI inside the terminal's alternate screen buffer so the
// full-screen UI doesn't clobber the user's scrollback, restoring it on exit.
export async function renderStackApp(): Promise<void> {
  process.stdout.write('\x1b[?1049h\x1b[H')
  const instance = render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
  try {
    await instance.waitUntilExit()
  } finally {
    process.stdout.write('\x1b[?1049l')
  }
}
