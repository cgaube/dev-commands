import { Box, Text } from 'ink'
import type { FlatNode } from '#src/stack/graph'
import { shrinkBranch } from './shrinkBranch'

type Props = {
  nodes: FlatNode[]
  selected: number
  maxRows?: number
  maxWidth?: number
}

export function Tree({ nodes, selected, maxRows, maxWidth }: Props) {
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

      {visible.map(({ node, depth }, i) => {
        const index = start + i
        const isSelected = index === selected
        const indent = '  '.repeat(depth)
        const cursor = isSelected ? '❯ ' : '  '
        const marker = node.isCurrent ? '●' : node.isTrunk ? '⌂' : '○'

        // Badge text: ahead/behind counts and status tags.
        const badges: string[] = []
        if (node.ahead > 0) badges.push(`+${node.ahead}`)
        if (node.behind > 0) badges.push(`-${node.behind}`)
        if (node.isDirty) badges.push('*')
        if (node.isCurrent) badges.push('[current]')
        if (!node.isTrunk && node.isMerged && (node.ahead > 0 || node.behind > 0))
          badges.push('[merged]')
        if (!node.exists) badges.push('[gone]')
        const badgeText = badges.length ? ' ' + badges.join(' ') : ''

        // Prefix: cursor + indent + marker + space
        const prefixLen = cursor.length + indent.length + 2 // marker + space
        const availableForName = maxWidth
          ? maxWidth - prefixLen - badgeText.length
          : Infinity
        const displayName =
          availableForName < node.name.length
            ? shrinkBranch(node.name, Math.max(4, availableForName))
            : node.name

        return (
          <Box key={node.name}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {cursor}
              {indent}
              <Text color={node.isCurrent ? 'green' : undefined}>
                {marker}{' '}
              </Text>
              {displayName}
            </Text>

            {node.ahead > 0 && <Text color="green"> +{node.ahead}</Text>}
            {node.behind > 0 && <Text color="red"> -{node.behind}</Text>}

            {node.isDirty && <Text color="yellow"> *</Text>}
            {node.isCurrent && <Text color="cyan"> [current]</Text>}
            {!node.isTrunk && node.isMerged && (node.ahead > 0 || node.behind > 0) && (
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
