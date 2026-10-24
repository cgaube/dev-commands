import { Text } from 'ink'

// The commits after the parent, with the octicon git_commit icon.
export function AheadBadge({ count }: { count: number }) {
  return <Text color="green"> {`\uf417 ${count}`}</Text>
}
