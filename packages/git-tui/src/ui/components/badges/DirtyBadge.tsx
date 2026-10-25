import { Text } from 'ink'

// The files with changes that are not committed, with the octicon pencil.
export function DirtyBadge({ count }: { count: number }) {
  return <Text color="yellow"> {`\uf448 ${count}`}</Text>
}
