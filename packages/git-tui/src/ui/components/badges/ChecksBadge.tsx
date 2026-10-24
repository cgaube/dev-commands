import { Text } from 'ink'
import type { ChecksStatus } from '#src/stack/pr'

// The octicon pulse. It is for all the checks, from GitHub Actions,
// Buildkite or any other CI.
export const CI_ICON = '\uf469'

const STYLES = {
  success: { color: 'green', label: 'passing' },
  failure: { color: 'red', label: 'failing' },
  pending: { color: 'yellow', label: 'running' },
} as const

// The CI icon and the result of the checks, in its color.
export function ChecksBadge({ status }: { status: ChecksStatus }) {
  if (!status) return null
  const { color, label } = STYLES[status]
  return <Text color={color}> {`${CI_ICON} ${label}`}</Text>
}
