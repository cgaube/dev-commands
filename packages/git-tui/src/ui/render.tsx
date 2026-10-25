import { render } from 'ink'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './components/App'
import { queryClient } from './query/client'

// Show the stack TUI in the alternate screen buffer, so that it does not
// change the scrollback of the user. Incremental rendering writes only the
// changed part of each line, so the spinners do not redraw the whole frame.
export async function renderStackApp(warning: string | null): Promise<void> {
  const instance = render(
    <QueryClientProvider client={queryClient}>
      <App warning={warning} />
    </QueryClientProvider>,
    { alternateScreen: true, incrementalRendering: true },
  )
  await instance.waitUntilExit()
}
