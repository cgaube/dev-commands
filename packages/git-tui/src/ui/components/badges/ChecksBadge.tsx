import { Text } from 'ink'
import type { ChecksStatus } from '#src/stack/pr'

const COLORS = {
  success: 'green',
  failure: 'red',
  pending: 'yellow',
} as const

export function ChecksBadge({ status }: { status: ChecksStatus }) {
  if (!status) return null
  return <Text color={COLORS[status]}> ●</Text>
}
