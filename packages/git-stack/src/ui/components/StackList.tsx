import { Box, Text } from 'ink'
import type { PrInfo } from '#src/stack/pr'
import type { Row } from '../rows'
import { rowKey } from '../rows'
import { BranchRow } from './BranchRow'

type Props = {
  rows: Row[]
  selected: number
  maxRows?: number
  prs?: Record<string, PrInfo | null>
}

// The tree of stacks. When the rows do not fit, show a window around the
// selected row.
export function StackList({ rows, selected, maxRows, prs }: Props) {
  const total = rows.length
  let start = 0
  let visible = rows

  if (maxRows && total > maxRows) {
    const half = Math.floor(maxRows / 2)
    start = Math.min(Math.max(0, selected - half), total - maxRows)
    visible = rows.slice(start, start + maxRows)
  }

  const hiddenAbove = start
  const hiddenBelow = total - (start + visible.length)

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 && <Text dimColor>↑ {hiddenAbove} more</Text>}

      {visible.map((row, i) => (
        <BranchRow
          key={rowKey(row)}
          row={row}
          isSelected={start + i === selected}
          pr={row.branch ? prs?.[row.name] : undefined}
        />
      ))}

      {hiddenBelow > 0 && <Text dimColor>↓ {hiddenBelow} more</Text>}
    </Box>
  )
}
