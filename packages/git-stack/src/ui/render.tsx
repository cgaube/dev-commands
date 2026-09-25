import { render } from 'ink'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './components/App'
import { queryClient } from './query/client'

// Show the stack TUI in the alternate screen buffer, so that it does not
// change the scrollback of the user.
export async function renderStackApp(warning: string | null): Promise<void> {
  process.stdout.write('\x1b[?1049h\x1b[H')
  const instance = render(
    <QueryClientProvider client={queryClient}>
      <App warning={warning} />
    </QueryClientProvider>,
  )
  try {
    await instance.waitUntilExit()
  } finally {
    process.stdout.write('\x1b[?1049l')
  }
}
