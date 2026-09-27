import { Box, Text } from 'ink'
import { stackLabel } from '#src/stack/model'
import type { Row as StackRow } from '../rows'
import type { PrInfo } from '#src/stack/pr'

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

function prColor(state: string, isDraft: boolean): string | undefined {
  if (isDraft) return 'gray'
  switch (state) {
    case 'OPEN':
      return 'green'
    case 'MERGED':
      return 'magenta'
    case 'CLOSED':
      return 'red'
    default:
      return undefined
  }
}

function checksColor(status: string): string {
  if (status === 'success') return 'green'
  if (status === 'failure') return 'red'
  return 'yellow'
}

function checksLabel(status: string): string {
  if (status === 'success') return '● passing'
  if (status === 'failure') return '● failing'
  return '● pending'
}

function reviewColor(decision: string): string {
  if (decision === 'APPROVED') return 'green'
  if (decision === 'CHANGES_REQUESTED') return 'red'
  return 'yellow'
}

function reviewLabel(decision: string): string {
  if (decision === 'APPROVED') return '✓ approved'
  if (decision === 'CHANGES_REQUESTED') return '✗ changes requested'
  return '◌ review required'
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
          <Text color={prColor(pr.state, pr.isDraft)}>
            #{pr.number} {pr.isDraft ? 'DRAFT' : pr.state}
          </Text>{' '}
          {pr.title} <Text dimColor>(o to open)</Text>
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
      <Text color={checksColor(pr.checksStatus)}>
        {checksLabel(pr.checksStatus)}
      </Text>
    </Box>
  )
}

function ReviewRow({ pr }: { pr: PrState }) {
  if (!pr || pr === 'loading' || !pr.reviewDecision) return null
  return (
    <Box>
      <Box width={8}>
        <Text dimColor>review</Text>
      </Box>
      <Text color={reviewColor(pr.reviewDecision)}>
        {reviewLabel(pr.reviewDecision)}
      </Text>
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
      branch ? '' : 'trunk',
      row.isCurrent ? 'current' : '',
      branch?.isDirty ? 'dirty' : '',
      branch?.isMerged ? 'merged' : '',
      branch?.needsRebase ? 'needs rebase' : '',
      branch && !branch.exists && !branch.isMerged ? 'gone' : '',
    ]
      .filter(Boolean)
      .join(', ') || 'stacked'

  return (
    <Box flexDirection="column">
      <Row label="name" value={row.name} />
      <Row
        label="stack"
        value={
          row.stack
            ? stackLabel(row.stack)
            : `trunk of ${row.stacks.length} ${row.stacks.length === 1 ? 'stack' : 'stacks'}`
        }
      />
      {branch && <Row label="parent" value={branch.parent} />}
      {branch && <Row label="ahead" value={String(branch.ahead)} />}
      <Row label="status" value={status} />
      <PrRow pr={pr} />
      <CiRow pr={pr} />
      <ReviewRow pr={pr} />
    </Box>
  )
}
