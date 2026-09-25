import { Box, Text } from 'ink'
import type { PrInfo } from '#src/stack/pr'
import type { Row } from '../rows'
import {
  AheadBadge,
  NeedsRebaseBadge,
  MergedBadge,
  DivergedBadge,
  DirtyBadge,
  GoneBadge,
  ChecksBadge,
  ReviewBadge,
} from './badges'

type Props = {
  row: Row
  isSelected: boolean
  pr?: PrInfo | null
}

export function BranchRow({ row, isSelected, pr }: Props) {
  const { branch, stack } = row
  const cursor = isSelected ? '❯ ' : '  '
  const indent = '  '.repeat(row.depth)
  const marker = row.isCurrent ? '●' : branch ? '○' : '⌂'

  return (
    <Box backgroundColor={isSelected ? 'gray' : undefined}>
      <Box flexShrink={0} marginRight={1}>
        <Text>
          {cursor}
          {indent}
        </Text>
        <Text
          color={row.isCurrent ? 'green' : isSelected ? 'cyan' : undefined}
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
          {row.name}
        </Text>
      </Box>

      {branch && (
        <Box flexShrink={0}>
          {row.isStackStart && stack?.number && (
            <Text dimColor> stack #{stack.number}</Text>
          )}
          {branch.ahead > 0 && <AheadBadge count={branch.ahead} />}
          {branch.isMerged && <MergedBadge />}
          {branch.needsRebase && <NeedsRebaseBadge />}
          {branch.diverged && <DivergedBadge />}
          {branch.isDirty && <DirtyBadge />}
          {!branch.exists && !branch.isMerged && <GoneBadge />}
          {pr && (
            <>
              <ChecksBadge status={pr.checksStatus} />
              <ReviewBadge decision={pr.reviewDecision} />
            </>
          )}
        </Box>
      )}
    </Box>
  )
}
