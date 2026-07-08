import { Box, Text } from 'ink'

type Props = {
  trunk: string
  branchCount: number
  currentBranch?: string
}

// Title bar: the app name and a one-line summary of the current stack.
export function Header({ trunk, branchCount, currentBranch }: Props) {
  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
      flexShrink={0}
    >
      <Text bold color="cyan">
        Git Stack
      </Text>
      <Text dimColor>
        trunk: {trunk} · {branchCount} branches · current: {currentBranch}
      </Text>
    </Box>
  )
}
