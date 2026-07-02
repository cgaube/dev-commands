import { Box, Text } from 'ink'
import type { BranchLog } from '#src/stack/log'
import { Kbd } from './Kbd'

type Props = {
  log: BranchLog
  maxLines: number
}

function splitOneline(line: string): { sha: string; subject: string } {
  const space = line.indexOf(' ')
  return space === -1
    ? { sha: line, subject: '' }
    : { sha: line.slice(0, space), subject: line.slice(space + 1) }
}

// Log tab content: `git log --oneline` for the selected branch vs its parent
// (short sha dimmed to yellow like git), followed by the parent's tip commit
// dimmed for context. Rendered inside the shared right-panel frame.
export function LogPane({ log, maxLines }: Props) {
  const allLines = log.commits ? log.commits.split('\n') : []
  const movedHint = log.parentMoved
  const reserved = (log.base ? 1 : 0) + (movedHint ? 2 : 0)
  const limit = Math.max(1, maxLines - reserved)
  const lines = allLines.slice(0, limit)
  const clipped = allLines.length > limit

  if (log.error) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">{log.error}</Text>
        <Text dimColor>press s to sync</Text>
      </Box>
    )
  }

  if (lines.length === 0 && !log.base) return <Text dimColor>no commits</Text>

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        const { sha, subject } = splitOneline(line)
        return (
          <Text key={i} wrap="truncate-end">
            <Text color="yellow">{sha}</Text> {subject}
          </Text>
        )
      })}
      {clipped && <Text dimColor>… more</Text>}
      {log.base && (
        <Text dimColor wrap="truncate-end">
          {(() => {
            const { sha, subject } = splitOneline(log.base)
            return `${sha} ${subject}  (${log.parent})`
          })()}
        </Text>
      )}
      {movedHint && (
        <>
          <Text> </Text>
          <Text color="yellow">
            ! parent has new commits — <Kbd>r</Kbd> to restack
          </Text>
        </>
      )}
    </Box>
  )
}
