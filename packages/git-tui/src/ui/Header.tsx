import { useEffect, useState } from 'react'
import type { Model } from '#src/data/model'
import { Kbd } from './Kbd'
import { age, color } from './theme'

// The rows that the header uses: the bar, and an empty row below it.
export const HEADER_HEIGHT = 2

// Render again each few seconds, so that "PRs 12s ago" stays correct.
function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// "12s", "3m": the time since the PRs were read.
function since(ms: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - ms) / 1000))
  return seconds < 60 ? `${seconds}s` : age(Math.floor(ms / 1000))
}

function ThemeButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <text
      flexShrink={0}
      onMouseDown={onClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      <Kbd k="t" />
      <span fg={hover ? color.text : color.dim}>
        {' '}
        {hover ? <u>{label}</u> : label}
      </span>
    </text>
  )
}

// The bar at the top: the repository and the current branch on the left,
// the state of the PR data and the theme on the right.
export function Header({
  repoName,
  model,
  spinner,
  prsUpdatedAt,
  prsFetching,
  prsError,
  themeLabel,
  onTheme,
}: {
  repoName: string
  model: Model
  spinner: string
  prsUpdatedAt: number
  prsFetching: boolean
  prsError: string | null
  themeLabel: string
  onTheme: () => void
}) {
  const now = useNow()
  const { repo } = model
  const stacks = model.sections.filter((s) => s.kind === 'stack').length
  const branches =
    model.sections.find((s) => s.kind === 'branch')?.rows.length ?? 0
  const counts = [
    stacks && `${stacks} stack${stacks > 1 ? 's' : ''}`,
    branches && `${branches} branch${branches > 1 ? 'es' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const prState = prsError ? (
    <span fg={color.red}>gh: {prsError.slice(0, 40)}</span>
  ) : prsFetching ? (
    <span fg={color.dim}>{spinner} reading PRs</span>
  ) : prsUpdatedAt ? (
    <span fg={color.dim}>PRs {since(prsUpdatedAt, now)} ago</span>
  ) : null

  return (
    <box flexDirection="column" height={HEADER_HEIGHT} flexShrink={0}>
      <box
        flexDirection="row"
        height={1}
        paddingLeft={2}
        paddingRight={2}
        gap={3}
        backgroundColor={color.selected}
      >
        <text flexShrink={0}>
          <strong fg={color.accent}>{repoName}</strong>
        </text>
        <text flexShrink={1} wrapMode="none" truncate>
          <span fg={color.dim}>on </span>
          <strong fg={color.green}>
            {repo.currentBranch || '(no branch)'}
          </strong>
          {repo.changedFiles > 0 && (
            <span fg={color.yellow}> ✎{repo.changedFiles}</span>
          )}
        </text>
        <text
          flexGrow={1}
          flexShrink={1}
          fg={color.dim}
          wrapMode="none"
          truncate
        >
          {counts}
        </text>
        <text flexShrink={0}>{prState}</text>
        <ThemeButton label={themeLabel} onClick={onTheme} />
      </box>
    </box>
  )
}
