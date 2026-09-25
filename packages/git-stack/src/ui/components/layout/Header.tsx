import { Box, Text } from 'ink'

type Props = {
  stackCount: number
  currentBranch?: string
}

// The title bar: the app name and a one-line summary.
export function Header({ stackCount, currentBranch }: Props) {
  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
    >
      <Text bold color="cyan">
        GitHub Stacks
      </Text>
      <Text dimColor>
        {stackCount} {stackCount === 1 ? 'stack' : 'stacks'} · current:{' '}
        {currentBranch ?? '—'}
      </Text>
    </Box>
  )
}
