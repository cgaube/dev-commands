import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { PrInfo } from '#src/stack/pr'
import type { Row } from '../../rows'
import { StackList } from '../StackList'
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight'

type Props = {
  rows: Row[]
  selected: number
  prs: Record<string, PrInfo | null>
  syncing: boolean
  maxHeight?: number
  // Side-by-side layout: take half of the width and the full height.
  side?: boolean
}

// The stack list. It gets the height of its branches up to maxHeight. Then it
// clips and scrolls, and StackList shows "↑/↓ N more".
export function StackPane({
  rows,
  selected,
  prs,
  syncing,
  maxHeight,
  side,
}: Props) {
  const [listRef, listRows] = useMeasuredHeight()

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      flexShrink={0}
      width={side ? '50%' : undefined}
      maxHeight={maxHeight}
      overflow="hidden"
    >
      <Box justifyContent="space-between">
        <Text bold>Stacks</Text>
        {syncing && (
          <Box gap={1}>
            <Text color="blue">syncing</Text>
            <Spinner />
          </Box>
        )}
      </Box>
      <Box
        ref={listRef}
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        overflow="hidden"
      >
        <StackList
          rows={rows}
          selected={selected}
          maxRows={listRows}
          prs={prs}
        />
        {rows.length === 0 && (
          <Text dimColor>no stacks — press N to start one</Text>
        )}
      </Box>
    </Box>
  )
}
