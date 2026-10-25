import { Box, Text } from 'ink'
import { stackLabel } from '#src/stack/model'
import type { Row as StackRow } from '../rows'
import { prStatus, type PrInfo } from '#src/stack/pr'
import { formatAge, PrStatusLabel, PR_STATUS_STYLES } from './badges'

// 'loading' while the PR lookup is in flight, null when there's no PR (or no gh),
// undefined when PR info doesn't apply (e.g. trunk).
type PrState = PrInfo | null | 'loading' | undefined

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Box width={8}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{value}</Text>
    </Box>
  )
}

function checksColor(status: string): string {
  if (status === 'success') return 'green'
  if (status === 'failure') return 'red'
  return 'yellow'
}

// The result, then the checks that are not done or failed, then the count,
// e.g. "failing lint, e2e (3/5 passed)".
function checksLabel(pr: PrInfo): string {
  const { total, passed, failing, pending } = pr.checks
  const count = `(${passed}/${total} passed)`
  if (pr.checksStatus === 'failure') {
    return `failing ${failing.join(', ')} ${count}`
  }
  if (pr.checksStatus === 'pending') {
    return `pending ${pending.join(', ')} ${count}`
  }
  return `passing ${count}`
}

// The time since the last commit, e.g. "3d ago".
function updatedLabel(committedAt: number): string {
  const age = formatAge(Math.max(0, Date.now() / 1000 - committedAt))
  return age === 'now' ? 'just now' : `${age} ago`
}

// Uses the icons and colors of the PR status labels.
function reviewLabel(decision: string): { text: string; color: string } {
  if (decision === 'APPROVED') {
    const { icon, color } = PR_STATUS_STYLES.approved
    return { text: `${icon} approved`, color }
  }
  if (decision === 'CHANGES_REQUESTED') {
    const { icon, color } = PR_STATUS_STYLES.rework
    return { text: `${icon} changes requested`, color }
  }
  const { icon, color } = PR_STATUS_STYLES.review
  return { text: `${icon} review required`, color }
}

function PrRow({ pr }: { pr: PrState }) {
  if (pr === undefined) return null
  return (
    <Box>
      <Box width={8}>
        <Text dimColor>pr</Text>
      </Box>
      {pr === 'loading' ? (
        <Text dimColor>checking…</Text>
      ) : pr === null ? (
        <Text dimColor>none</Text>
      ) : (
        <Text wrap="truncate-end">
          #{pr.number} <PrStatusLabel status={prStatus(pr)} /> {pr.title}{' '}
          <Text dimColor>(o to open)</Text>
        </Text>
      )}
    </Box>
  )
}

function CiRow({ pr }: { pr: PrState }) {
  if (!pr || pr === 'loading' || !pr.checksStatus) return null
  return (
    <Box>
      <Box width={8}>
        <Text dimColor>ci</Text>
      </Box>
      <Text color={checksColor(pr.checksStatus)} wrap="truncate-end">
        {checksLabel(pr)}
      </Text>
    </Box>
  )
}

function ReviewRow({ pr }: { pr: PrState }) {
  if (!pr || pr === 'loading' || !pr.reviewDecision) return null
  const review = reviewLabel(pr.reviewDecision)
  return (
    <Box>
      <Box width={8}>
        <Text dimColor>review</Text>
      </Box>
      <Text color={review.color}>{review.text}</Text>
    </Box>
  )
}

// The Info tab: a short summary of the selected branch. The shared frame of
// the right panel contains it, so it has no border or title.
export function InfoPane({ row, pr }: { row?: StackRow; pr: PrState }) {
  if (!row) return <Text dimColor>no selection</Text>

  const { branch } = row
  const status =
    [
      row.kind === 'trunk' ? 'trunk' : '',
      row.isCurrent ? 'current' : '',
      branch?.changedFiles
        ? `${branch.changedFiles} uncommitted ${branch.changedFiles === 1 ? 'file' : 'files'}`
        : '',
      branch?.isMerged ? 'merged' : '',
      branch?.needsRebase ? 'needs rebase' : '',
      branch?.unpushed ? `${branch.unpushed} to push` : '',
      branch?.unpulled ? `${branch.unpulled} to pull` : '',
      branch?.exists && !branch.isMerged && !branch.hasRemote
        ? 'not pushed'
        : '',
      branch && !branch.exists && !branch.isMerged ? 'gone' : '',
    ]
      .filter(Boolean)
      .join(', ') || (row.kind === 'plain' ? 'not stacked' : 'stacked')

  return (
    <Box flexDirection="column">
      <Row label="name" value={row.name} />
      <Row
        label="stack"
        value={
          row.kind === 'plain'
            ? 'none — n makes one'
            : row.stack
              ? stackLabel(row.stack)
              : `trunk of ${row.stacks.length} ${row.stacks.length === 1 ? 'stack' : 'stacks'}`
        }
      />
      {branch && <Row label="parent" value={branch.parent} />}
      {branch && <Row label="ahead" value={String(branch.ahead)} />}
      <Row label="status" value={status} />
      {branch?.committedAt != null && (
        <Row label="updated" value={updatedLabel(branch.committedAt)} />
      )}
      <PrRow pr={pr} />
      <CiRow pr={pr} />
      <ReviewRow pr={pr} />
    </Box>
  )
}
