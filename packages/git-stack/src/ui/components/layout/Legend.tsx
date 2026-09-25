import { Box, Text } from 'ink'
import { Kbd } from '../Kbd'

type Hint = [key: string, action: string]

const ALWAYS: Hint[] = [
  ['↑↓', 'move'],
  ['↵', 'checkout'],
]

const STACK: Hint[] = [
  ['n', 'add'],
  ['r', 'rebase'],
  ['P', 'submit'],
  ['S', 'sync'],
]

const EMPTY: Hint[] = [['N', 'new stack']]

const TAIL: Hint[] = [
  ['?', 'help'],
  ['q', 'quit'],
]

type Props = { hasStacks: boolean; rebaseInProgress: boolean }

export function Legend({ hasStacks, rebaseInProgress }: Props) {
  const hints = [...(hasStacks ? [...ALWAYS, ...STACK] : EMPTY), ...TAIL]

  if (rebaseInProgress) {
    return (
      <Box justifyContent="center" paddingX={1} marginBottom={1} flexShrink={0}>
        <Text color="yellow">
          rebase in progress — in a terminal: gh stack rebase --continue or
          --abort
        </Text>
      </Box>
    )
  }

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
