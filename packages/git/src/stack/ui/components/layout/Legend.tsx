import { Box, Text } from 'ink'
import { Kbd } from '../Kbd'

type Hint = [key: string, action: string]

const ALWAYS: Hint[] = [
  ['↑↓', 'move'],
  ['↵', 'checkout'],
]

const BRANCH: Hint[] = [
  ['p', 'push'],
  ['P', 'create-pr'],
  ['o', 'open-pr'],
]

const TAIL: Hint[] = [
  ['r', 'restack'],
  ['?', 'help'],
  ['q', 'quit'],
]

export function Legend({ isTrunk }: { isTrunk: boolean }) {
  const hints = isTrunk ? [...ALWAYS, ...TAIL] : [...ALWAYS, ...BRANCH, ...TAIL]

  return (
    <Box
      justifyContent="center"
      columnGap={1}
      flexWrap={'wrap'}
      paddingX={1}
      marginBottom={1}
      flexShrink={0}
    >
      {hints.map(([key, action]) => (
        <Box key={key}>
          <Kbd>{key}</Kbd>
          <Text dimColor> {action}</Text>
        </Box>
      ))}
    </Box>
  )
}
