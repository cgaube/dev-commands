import { Box, Text } from 'ink'
import { Kbd } from './Kbd'

export type TabMode = 'info' | 'log'

export const TABS: { key: string; label: string; mode: TabMode }[] = [
  { key: 'i', label: 'Info', mode: 'info' },
  { key: 'l', label: 'Log', mode: 'log' },
]

// Tab strip rendered at the top of the right panel. The active tab is
// highlighted; each tab shows its shortcut key.
export function Tabs({ active }: { active: TabMode }) {
  return (
    <Box justifyContent="space-between">
      <Box>
        {TABS.map((tab) => {
          const isActive = tab.mode === active
          return (
            <Box key={tab.mode} marginRight={2}>
              <Kbd>{tab.key}</Kbd>
              <Text
                color={isActive ? 'cyan' : 'gray'}
                bold={isActive}
                underline={isActive}
              >
                {' '}
                {tab.label}
              </Text>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
