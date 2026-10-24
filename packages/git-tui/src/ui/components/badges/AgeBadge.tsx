import { Text } from 'ink'

const UNITS: [suffix: string, seconds: number][] = [
  ['y', 365 * 24 * 3600],
  ['mo', 30 * 24 * 3600],
  ['w', 7 * 24 * 3600],
  ['d', 24 * 3600],
  ['h', 3600],
  ['m', 60],
]

// A short age, such as "3d" or "2mo". Less than a minute is "now".
export function formatAge(seconds: number): string {
  for (const [suffix, size] of UNITS) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${suffix}`
  }
  return 'now'
}

// The time since the last commit of the branch.
export function AgeBadge({ committedAt }: { committedAt: number }) {
  const age = Math.max(0, Date.now() / 1000 - committedAt)
  return <Text dimColor> {formatAge(age)}</Text>
}
