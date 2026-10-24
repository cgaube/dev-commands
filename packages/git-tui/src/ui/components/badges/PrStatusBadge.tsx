import { Text } from 'ink'
import type { PrStatus } from '#src/stack/pr'

// GitHub Octicons from Nerd Fonts, so the terminal needs a Nerd Font. The
// conflicts icon is a codicon, new in Nerd Fonts 3.5.
export const PR_STATUS_STYLES: Record<
  PrStatus,
  { icon: string; color: string }
> = {
  merged: { icon: '\uf419', color: 'magenta' }, // git_merge
  closed: { icon: '\uf4dc', color: 'gray' }, // git_pull_request_closed
  draft: { icon: '\uf4dd', color: 'gray' }, // git_pull_request_draft
  conflicts: { icon: '\uec6e', color: 'red' }, // cod git_branch_conflicts
  rework: { icon: '\uf4d2', color: 'red' }, // file_diff
  behind: { icon: '\uf46a', color: 'blue' }, // sync
  ready: { icon: '\uf427', color: 'green' }, // rocket
  approved: { icon: '\uf42e', color: 'cyan' }, // check
  review: { icon: '\uf441', color: 'yellow' }, // eye
}

// The icon and word, in the color of the status.
export function PrStatusLabel({
  status,
  dim,
}: {
  status: PrStatus
  dim?: boolean
}) {
  const { icon, color } = PR_STATUS_STYLES[status]
  return (
    <Text color={color} dimColor={dim}>
      {icon} {status}
    </Text>
  )
}

// The label after the other badges of a branch row.
export function PrStatusBadge({
  status,
  dim,
}: {
  status: PrStatus
  dim?: boolean
}) {
  return (
    <Text>
      {'  '}
      <PrStatusLabel status={status} dim={dim} />
    </Text>
  )
}
