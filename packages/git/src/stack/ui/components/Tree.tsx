import { Box, Text } from 'ink'
import type { FlatNode } from '#src/stack/graph'
import type { PrInfo } from '#src/stack/pr'
import { shrinkBranch } from '../utils/shrinkBranch'

type Props = {
  nodes: FlatNode[]
  selected: number
  maxRows?: number
  maxWidth?: number
  prs?: Record<string, PrInfo | null>
}

export function Tree({ nodes, selected, maxRows, maxWidth, prs }: Props) {
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

        const badges: string[] = []
        if (node.ahead > 0) badges.push(`+${node.ahead}`)
        if (node.parentMoved) badges.push('!')
        if (node.diverged) badges.push('⇡⇣')
        if (node.isDirty) badges.push('*')
        if (!node.exists) badges.push('[gone]')
        const badgeText = badges.length ? ' ' + badges.join(' ') : ''

        const pr = !node.isTrunk ? prs?.[node.name] : undefined
        let prBadgeWidth = 0
        if (pr) {
          if (pr.checksStatus) prBadgeWidth += 2
          if (
            pr.reviewDecision === 'APPROVED' ||
            pr.reviewDecision === 'CHANGES_REQUESTED'
          )
            prBadgeWidth += 2
        }

        // Prefix: cursor + indent + marker + space
        const prefixLen = cursor.length + indent.length + 2 // marker + space
        const availableForName = maxWidth
          ? maxWidth - prefixLen - badgeText.length - prBadgeWidth
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

            {node.parentMoved && <Text color="yellow"> {'!'}</Text>}
            {node.diverged && <Text color="yellow"> ⇡⇣</Text>}
            {node.isDirty && <Text color="yellow"> *</Text>}
            {!node.exists && <Text color="red"> [gone]</Text>}

            {pr?.checksStatus && (
              <Text
                color={
                  pr.checksStatus === 'success'
                    ? 'green'
                    : pr.checksStatus === 'failure'
                      ? 'red'
                      : 'yellow'
                }
              >
                {' '}
                ●
              </Text>
            )}
            {pr?.reviewDecision === 'APPROVED' && <Text color="green"> ✓</Text>}
            {pr?.reviewDecision === 'CHANGES_REQUESTED' && (
              <Text color="red"> ✗</Text>
            )}
          </Box>
        )
      })}

      {hiddenBelow > 0 && <Text dimColor>↓ {hiddenBelow} more</Text>}
    </Box>
  )
}
