import { Text } from 'ink'

export function AheadBadge({ count }: { count: number }) {
  return <Text color="green"> +{count}</Text>
}
