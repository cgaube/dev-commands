import { Box, Text } from 'ink'
import { Kbd } from '../Kbd'

// Keyboard shortcuts shown in the legend bar, in display order.
const HINTS: [key: string, action: string][] = [
  ['↑↓', 'move'],
  ['↵', 'checkout'],
  ['n', 'new'],
  ['p', 'push'],
  ['P', 'create-pr'],
  ['o', 'open-pr'],
  ['r', 'restack'],
  ['s', 'sync'],
  ['R', 'refresh'],
  ['q', 'quit'],
]

// Legend bar: key caps paired with their action labels, wrapping to fit the
// terminal width.
export function Legend() {
  return (
    <Box
      justifyContent="center"
      columnGap={1}
      flexWrap={'wrap'}
      paddingX={1}
      marginBottom={1}
    >
      {HINTS.map(([key, action]) => (
        <Box key={key}>
          <Kbd>{key}</Kbd>
          <Text dimColor> {action}</Text>
        </Box>
      ))}
    </Box>
  )
}
