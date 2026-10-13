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
  // Side-by-side layout: the share of the width, e.g. '50%'. The list then
  // takes the full height.
  width?: string
}

// The lines around the rows: the top and bottom border, and the title.
const FRAME_LINES = 3

// The stack list. It gets the height of its branches up to maxHeight. Then it
// clips and scrolls, and StackList shows "↑/↓ N more".
// The height comes from the number of rows, not from what StackList draws.
// StackList draws fewer rows when it scrolls, and it gets its row count from
// the measured height. A height from the drawn content would then shrink at
// each render, and the renders would not stop.
export function StackPane({
  rows,
  selected,
  prs,
  syncing,
  maxHeight,
  width,
}: Props) {
  const [listRef, listRows] = useMeasuredHeight()
  // An empty list shows one line of text.
  const height =
    maxHeight === undefined
      ? undefined
      : Math.min(maxHeight, Math.max(rows.length, 1) + FRAME_LINES)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      flexShrink={0}
      width={width}
      height={height}
      overflow="hidden"
    >
      <Box justifyContent="space-between">
        <Text bold>Branches</Text>
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
          <Text dimColor>no branches — press N to start one</Text>
        )}
      </Box>
    </Box>
  )
}
