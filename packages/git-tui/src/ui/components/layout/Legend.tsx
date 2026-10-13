import { Box, Text } from 'ink'
import type { RowKind } from '../../rows'
import type { RebaseKind } from '#src/stack/model'
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
    ['r', 'rebase'],
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

type Props = { kind?: RowKind; rebase: RebaseKind | null }

// How to stop each kind of rebase. The TUI does not abort it for you.
const ABORT: Record<RebaseKind, string> = {
  stack: 'gh stack rebase --abort',
  git: 'git rebase --abort',
}

export function Legend({ kind, rebase }: Props) {
  const hints = [...(kind ? [...ALWAYS, ...BY_KIND[kind]] : EMPTY), ...TAIL]

  if (rebase) {
    return (
      <Box justifyContent="center" paddingX={1} marginBottom={1} flexShrink={0}>
        <Text color="yellow">
          rebase in progress — fix the files, git add them, then press r (to
          stop: {ABORT[rebase]})
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
