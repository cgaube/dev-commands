import { Box, Text } from 'ink'
import type { BranchLog } from '#src/stack/log'
import { Kbd } from './Kbd'

type Props = {
  log: BranchLog
  maxLines: number
  needsRebase: boolean
  // A plain branch is not in a stack, so the stack keys do not apply to it.
  plain: boolean
}

function splitOneline(line: string): { sha: string; subject: string } {
  const space = line.indexOf(' ')
  return space === -1
    ? { sha: line, subject: '' }
    : { sha: line.slice(0, space), subject: line.slice(space + 1) }
}

// A dim line that names the parent, e.g. "── on main ─────". It fills the
// width: the box after the label has only a top border.
function ParentDivider({ parent }: { parent: string }) {
  return (
    <Box>
      <Text dimColor>── on {parent} </Text>
      <Box
        flexGrow={1}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderDimColor
      />
    </Box>
  )
}

// The Log tab: `git log --oneline` of the selected branch from its base, with
// the short sha in yellow like git. A divider that names the parent follows,
// then the base commit, dimmed, for context. The shared frame of the right
// panel contains it.
export function LogPane({ log, maxLines, needsRebase, plain }: Props) {
  const allLines = log.commits ? log.commits.split('\n') : []
  const movedHint = needsRebase
  const reserved = (log.base ? 2 : 0) + (movedHint ? 2 : 0)
  const room = Math.max(1, maxLines - reserved)
  // A branch shows all its own commits, so the count is exact. A trunk
  // shows only its latest commits.
  const isTrunk = !log.parent
  // The "more" line takes a line too.
  const needsMore = allLines.length > room || (isTrunk && !!log.hasOlder)
  const lines = allLines.slice(0, Math.max(1, needsMore ? room - 1 : room))
  const hidden = allLines.length - lines.length
  const more = isTrunk
    ? hidden > 0 || log.hasOlder
      ? '… older commits'
      : ''
    : hidden > 0
      ? `… ${hidden} more ${hidden === 1 ? 'commit' : 'commits'}`
      : ''

  if (log.error) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">{log.error}</Text>
        <Text dimColor>
          press <Kbd>S</Kbd> to sync
        </Text>
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
      {more && <Text dimColor>{more}</Text>}
      {log.base && (
        <>
          <ParentDivider parent={log.parent} />
          <Text dimColor wrap="truncate-end">
            {log.base}
          </Text>
        </>
      )}
      {movedHint && (
        <>
          <Text> </Text>
          {plain ? (
            <Text color="yellow">
              ! {log.parent} has new commits — <Kbd>r</Kbd> rebase, then{' '}
              <Kbd>p</Kbd> push
            </Text>
          ) : (
            <Text color="yellow">
              ! {log.parent} has new commits — <Kbd>r</Kbd> rebase ·{' '}
              <Kbd>S</Kbd> rebase + push
            </Text>
          )}
        </>
      )}
    </Box>
  )
}
