import { homedir } from 'os'
import setupProgramConfiguration from '#common/config'
import { ConfigStore } from '#common/config/configStore'
import type { ConfigSchema } from '#common/config/types'
import { THEME_IDS, type ThemeId } from '#src/ui/theme'

const PROGRAM = 'git-tui'

const config = {
  theme: {
    label: 'Theme',
    description: 'the colors of the TUI. Press t in the TUI to change it',
    options: THEME_IDS,
    defaultValue: 'terminal',
    global: true,
  },
  conflictAgent: {
    label: 'Conflict agent',
    description:
      'fix rebase conflicts with Claude Code in the background (needs the claude command)',
    options: ['claude', 'off'],
    defaultValue: 'claude',
    global: true,
  },
} satisfies ConfigSchema

export const { getConfig, injectConfigCommands } = setupProgramConfiguration(
  PROGRAM,
  config,
)

// Save the theme at the home directory level, as `config init` does. Then
// it applies in all the repositories. Keep the other values of that file.
export async function saveTheme(theme: ThemeId): Promise<void> {
  const store = await ConfigStore.create(PROGRAM, homedir(), config)
  const current = (await store.getOverrides()) ?? {}
  const known = Object.fromEntries(
    Object.entries(current).filter(([key]) => key in config),
  )
  await store.saveConfig({ ...known, theme })
}
