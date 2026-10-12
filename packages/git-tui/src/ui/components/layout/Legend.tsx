import { Box, Text } from 'ink'
import type { RowKind } from '../../rows'
import { Kbd } from '../Kbd'

type Hint = [key: string, action: string]

const ALWAYS: Hint[] = [
  ['↑↓', 'move'],
  ['↵', 'checkout'],
]

// The keys that apply to each kind of row.
const BY_KIND: Record<RowKind, Hint[]> = {
  trunk: [
    ['n', 'new branch'],
    ['r', 'rebase all'],
    ['S', 'sync all'],
  ],
  stack: [
    ['n', 'add'],
    ['r', 'rebase'],
    ['P', 'submit'],
    ['p', 'submit to here'],
    ['S', 'sync'],
    ['o', 'open PR'],
  ],
  plain: [
    ['p', 'push + PR'],
    ['o', 'open PR'],
    ['n', 'make stack'],
    ['d', 'delete'],
  ],
}

const EMPTY: Hint[] = [['N', 'new branch']]

const TAIL: Hint[] = [
  ['?', 'help'],
  ['q', 'quit'],
]

type Props = { kind?: RowKind; rebaseInProgress: boolean }

export function Legend({ kind, rebaseInProgress }: Props) {
  const hints = [...(kind ? [...ALWAYS, ...BY_KIND[kind]] : EMPTY), ...TAIL]

  if (rebaseInProgress) {
    return (
      <Box justifyContent="center" paddingX={1} marginBottom={1} flexShrink={0}>
        <Text color="yellow">
          rebase in progress — fix the files, git add them, then press r (to
          stop: gh stack rebase --abort)
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
