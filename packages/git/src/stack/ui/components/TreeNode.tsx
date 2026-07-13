import { Box, Text } from 'ink'
import type { StackNode } from '#src/stack/graph'
import type { PrInfo } from '#src/stack/pr'
import {
  AheadBadge,
  ParentMovedBadge,
  DivergedBadge,
  DirtyBadge,
  GoneBadge,
  ChecksBadge,
  ReviewBadge,
} from './badges'

type Props = {
  node: StackNode
  depth: number
  isSelected: boolean
  pr?: PrInfo | null
}

export function TreeNode({ node, depth, isSelected, pr }: Props) {
  const cursor = isSelected ? '❯ ' : '  '
  const indent = '  '.repeat(depth)
  const marker = node.isCurrent ? '●' : node.isTrunk ? '⌂' : '○'

  return (
    <Box backgroundColor={isSelected ? 'gray' : undefined}>
      <Box flexShrink={0} marginRight={1}>
        <Text>
          {cursor}
          {indent}
        </Text>
        <Text
          color={node.isCurrent ? 'green' : isSelected ? 'cyan' : undefined}
          bold={isSelected}
        >
          {marker}
        </Text>
      </Box>

      <Box flexShrink={1} minWidth={0}>
        <Text
          color={isSelected ? 'cyan' : undefined}
          bold={isSelected}
          wrap="truncate-middle"
        >
          {node.name}
        </Text>
      </Box>

      <Box flexShrink={0}>
        {node.ahead > 0 && <AheadBadge count={node.ahead} />}
        {node.parentMoved && <ParentMovedBadge />}
        {node.diverged && <DivergedBadge />}
        {node.isDirty && <DirtyBadge />}
        {!node.exists && <GoneBadge />}

        {pr && (
          <>
            <ChecksBadge status={pr.checksStatus} />
            <ReviewBadge decision={pr.reviewDecision} />
          </>
        )}
      </Box>
    </Box>
  )
}
