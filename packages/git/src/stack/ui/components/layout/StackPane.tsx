import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { FlatNode } from '#src/stack/graph'
import type { PrInfo } from '#src/stack/pr'
import { Tree } from '../Tree'
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight'

type Props = {
  nodes: FlatNode[]
  selected: number
  prs: Record<string, PrInfo | null>
  syncing: boolean
  hasTrackedBranches: boolean
  maxHeight: number
}

// The stack tree: sizes to its branches up to maxHeight, then clips and scrolls
// (Tree shows "↑/↓ N more"). Measures its own content box so Tree knows how many
// rows it may render.
export function StackPane({
  nodes,
  selected,
  prs,
  syncing,
  hasTrackedBranches,
  maxHeight,
}: Props) {
  const [treeRef, treeRows] = useMeasuredHeight()

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      flexShrink={0}
      maxHeight={maxHeight}
      overflow="hidden"
    >
      <Box justifyContent="space-between">
        <Text bold>Stack</Text>
        {syncing && (
          <Box gap={1}>
            <Text color="blue">syncing</Text>
            <Spinner />
          </Box>
        )}
      </Box>
      <Box
        ref={treeRef}
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        overflow="hidden"
      >
        <Tree nodes={nodes} selected={selected} maxRows={treeRows} prs={prs} />
        {!hasTrackedBranches && (
          <Text dimColor>no tracked branches — press n to create one</Text>
        )}
      </Box>
    </Box>
  )
}
