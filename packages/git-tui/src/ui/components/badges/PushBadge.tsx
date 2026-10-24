import { Text } from 'ink'

type Props = {
  unpushed: number
  unpulled: number
  hasRemote: boolean
}

// The commits to push (⇡) and to pull (⇣), or "local" when the branch is
// not on origin yet.
export function PushBadge({ unpushed, unpulled, hasRemote }: Props) {
  if (!hasRemote) return <Text dimColor> local</Text>
  return (
    <>
      {unpushed > 0 && <Text color="cyan"> ⇡{unpushed}</Text>}
      {unpulled > 0 && <Text color="yellow"> ⇣{unpulled}</Text>}
    </>
  )
}
