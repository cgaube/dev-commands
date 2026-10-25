import { Box, Text } from 'ink'
import { prStatus, type PrInfo } from '#src/stack/pr'
import type { Row } from '../rows'
import {
  AheadBadge,
  NeedsRebaseBadge,
  MergedBadge,
  PushBadge,
  AgeBadge,
  DirtyBadge,
  GoneBadge,
  ChecksBadge,
  PrStatusBadge,
} from './badges'

// Shows on the first branch of a stack.
export const STACK_ICON = '≡'

type Props = {
  row: Row
  isSelected: boolean
  pr?: PrInfo | null
}

export function BranchRow({ row, isSelected, pr }: Props) {
  const { branch, stack } = row
  const cursor = isSelected ? '❯ ' : '  '
  const indent = '  '.repeat(row.depth)
  // The marker shows only if the branch is checked out. The first branch of
  // a stack also gets the stack icon after it.
  const marker = row.isCurrent ? '●' : row.kind === 'trunk' ? '⌂' : '○'
  // A merged branch stays in the tree, as on GitHub, but less visible.
  const dim = !!branch?.isMerged && !isSelected

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
          dimColor={dim}
        >
          {marker}
        </Text>
        {row.isStackStart && (
          <Text color="blue" dimColor={dim}>
            {' '}
            {STACK_ICON}
          </Text>
        )}
      </Box>

      <Box flexShrink={1} minWidth={0}>
        <Text
          color={isSelected ? 'cyan' : undefined}
          bold={isSelected}
          dimColor={dim}
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
          {/* The PR chip already says merged. */}
          {branch.isMerged && pr?.state !== 'MERGED' && <MergedBadge />}
          {branch.needsRebase && <NeedsRebaseBadge />}
          {branch.exists && !branch.isMerged && (
            <PushBadge
              unpushed={branch.unpushed}
              unpulled={branch.unpulled}
              hasRemote={branch.hasRemote}
            />
          )}
          {branch.changedFiles > 0 && (
            <DirtyBadge count={branch.changedFiles} />
          )}
          {!branch.exists && !branch.isMerged && <GoneBadge />}
          {pr && (
            <>
              <ChecksBadge status={pr.checksStatus} />
              <PrStatusBadge status={prStatus(pr)} dim={dim} />
            </>
          )}
        </Box>
      )}

      {/* The age goes to the right edge, so the ages line up. */}
      {branch?.committedAt != null && (
        <>
          <Box flexGrow={1} />
          <Box flexShrink={0} marginRight={1}>
            <AgeBadge committedAt={branch.committedAt} />
          </Box>
        </>
      )}
    </Box>
  )
}
