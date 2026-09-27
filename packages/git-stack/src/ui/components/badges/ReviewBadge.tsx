import { Text } from 'ink'

export function ReviewBadge({ decision }: { decision: string | null }) {
  if (decision === 'APPROVED') return <Text color="green"> ✓</Text>
  if (decision === 'CHANGES_REQUESTED') return <Text color="red"> ✗</Text>
  return null
}
