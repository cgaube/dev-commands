import { useRef } from 'react'
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

// The rows to keep between the cursor and the edge of the window, when
// there is space for them. The window scrolls only when the cursor comes
// closer.
const SCROLL_MARGIN = 2

// The window of rows to show, when `total` rows do not fit in `maxRows`
// lines. The "↑ N more" and "↓ N more" lines also take a line each, so a
// window in the middle shows maxRows - 2 rows, and a window at the top or the
// bottom shows maxRows - 1 rows.
// The window stays at `prevStart` while the cursor is not near an edge, so
// that the rows do not move at each key.
function scrollWindow(
  total: number,
  selected: number,
  maxRows: number,
  prevStart: number,
): { start: number; count: number } {
  // The first start at which the last row shows, without "↓ N more".
  const maxStart = total - (maxRows - 1)
  const countAt = (start: number) =>
    start === 0 || start >= maxStart ? maxRows - 1 : maxRows - 2
  // A very small window has no space for a margin.
  const margin = Math.max(
    0,
    Math.min(SCROLL_MARGIN, Math.floor((maxRows - 3) / 2)),
  )

  let start = Math.max(0, Math.min(prevStart, maxStart))
  if (selected < start + margin) {
    start = Math.max(0, selected - margin)
  }
  while (start < maxStart && selected > start + countAt(start) - 1 - margin) {
    start++
  }
  return { start, count: countAt(start) }
}

// The tree of branches. When the rows do not fit, show a window that
// contains the selected row.
export function StackList({ rows, selected, maxRows, prs }: Props) {
  const total = rows.length
  // The start of the last window. scrollWindow gives the same result for
  // the same input, so a second render does not move the window.
  const startRef = useRef(0)
  let start = 0
  let visible = rows

  if (maxRows && maxRows >= 3 && total > maxRows) {
    const window = scrollWindow(total, selected, maxRows, startRef.current)
    start = window.start
    visible = rows.slice(start, start + window.count)
  }
  startRef.current = start

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
