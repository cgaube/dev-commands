import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { queryClient } from './query'
import { isClaudeInstalled } from '#src/claude'
import { getConfig } from '#src/config'
import { applyTheme, color } from './theme'

// Show the TUI in the alternate screen, and wait until the user quits.
export async function startTui(): Promise<void> {
  const theme = applyTheme(await getConfig('theme'))
  const agentEnabled =
    (await getConfig('conflictAgent')) !== 'off' && isClaudeInstalled()
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    // The legacy key protocol gives the printed character for each key,
    // for example "R" and "?". The app reads keys that way.
    useKittyKeyboard: null,
    // Rows, key caps, PR titles and checks are clickable.
    useMouse: true,
    enableMouseMovement: true,
    // The terminal theme keeps the background of the terminal.
    backgroundColor: color.background,
  })
  const done = new Promise<void>((resolve) => {
    const quit = () => {
      renderer.destroy()
      resolve()
    }
    createRoot(renderer).render(
      <QueryClientProvider client={queryClient}>
        <App onQuit={quit} initialTheme={theme} agentEnabled={agentEnabled} />
      </QueryClientProvider>,
    )
  })
  await done
  await renderer.closed
  queryClient.clear()
}
