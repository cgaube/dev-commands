import { Box, Text } from 'ink'
import type { BranchLog } from '#src/stack/log'

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
  // Reserve a row for the dimmed base line when there is one.
  const limit = log.base ? Math.max(1, maxLines - 1) : maxLines
  const lines = allLines.slice(0, limit)
  const clipped = allLines.length > limit

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
    </Box>
  )
}
