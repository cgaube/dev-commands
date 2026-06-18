import { Box, Text } from 'ink'
import type { FlatNode } from '#src/stack/graph'

type Props = {
  nodes: FlatNode[]
  selected: number
  maxRows?: number
}

// Renders the flattened stack forest, one branch per row, indented by depth.
// When the tree is taller than `maxRows` it scrolls, keeping the cursor centred
// and showing how many rows are hidden above/below. The selected row carries the
// cursor; the checked-out branch is dotted; merged and missing branches get
// badges so `sync` candidates are obvious at a glance.
export function Tree({ nodes, selected, maxRows }: Props) {
  const total = nodes.length
  let start = 0
  let visible = nodes

  if (maxRows && total > maxRows) {
    // Reserve a row for each scroll indicator that is actually shown.
    const half = Math.floor(maxRows / 2)
    start = Math.min(Math.max(0, selected - half), total - maxRows)
    visible = nodes.slice(start, start + maxRows)
  }

  const hiddenAbove = start
  const hiddenBelow = total - (start + visible.length)

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 && <Text dimColor>↑ {hiddenAbove} more</Text>}

      {visible.map(({ node, depth }, i) => {
        const index = start + i
        const isSelected = index === selected
        const indent = '  '.repeat(depth)
        const cursor = isSelected ? '❯ ' : '  '
        const marker = node.isCurrent ? '●' : node.isTrunk ? '⌂' : '○'

        return (
          <Box key={node.name}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {cursor}
              {indent}
              <Text color={node.isCurrent ? 'green' : undefined}>
                {marker}{' '}
              </Text>
              {node.name}
            </Text>

            {node.ahead > 0 && <Text color="green"> +{node.ahead}</Text>}
            {node.behind > 0 && <Text color="red"> -{node.behind}</Text>}

            {node.isCurrent && <Text color="cyan"> [current]</Text>}
            {!node.isTrunk && node.isMerged && (
              <Text color="yellow"> [merged]</Text>
            )}
            {!node.exists && <Text color="red"> [gone]</Text>}
          </Box>
        )
      })}

      {hiddenBelow > 0 && <Text dimColor>↓ {hiddenBelow} more</Text>}
    </Box>
  )
}
