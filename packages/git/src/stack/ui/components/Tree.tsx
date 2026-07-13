import { Box, Text } from 'ink'
import type { FlatNode } from '#src/stack/graph'
import type { PrInfo } from '#src/stack/pr'
import { TreeNode } from './TreeNode'

type Props = {
  nodes: FlatNode[]
  selected: number
  maxRows?: number
  prs?: Record<string, PrInfo | null>
}

export function Tree({ nodes, selected, maxRows, prs }: Props) {
  const total = nodes.length
  let start = 0
  let visible = nodes

  if (maxRows && total > maxRows) {
    const half = Math.floor(maxRows / 2)
    start = Math.min(Math.max(0, selected - half), total - maxRows)
    visible = nodes.slice(start, start + maxRows)
  }

  const hiddenAbove = start
  const hiddenBelow = total - (start + visible.length)

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 && <Text dimColor>↑ {hiddenAbove} more</Text>}

      {visible.map(({ node, depth }, i) => (
        <TreeNode
          key={node.name}
          node={node}
          depth={depth}
          isSelected={start + i === selected}
          pr={!node.isTrunk ? prs?.[node.name] : undefined}
        />
      ))}

      {hiddenBelow > 0 && <Text dimColor>↓ {hiddenBelow} more</Text>}
    </Box>
  )
}
