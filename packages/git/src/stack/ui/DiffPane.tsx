import { Box, Text } from 'ink'

type Props = {
  diff: string
  truncated: boolean
  maxLines: number
}

// Color a unified-diff line by its leading character, matching how a pager would
// show it: green for additions, red for removals, cyan for hunk headers.
function lineColor(line: string): string | undefined {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'green'
  if (line.startsWith('-') && !line.startsWith('---')) return 'red'
  if (line.startsWith('@@')) return 'cyan'
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'gray'
  return undefined
}

// Diff tab content (vs the selected branch's parent). Rendered inside the shared
// right-panel frame, so no border/title of its own.
export function DiffPane({ diff, truncated, maxLines }: Props) {
  const allLines = diff.length ? diff.split('\n') : []
  const lines = allLines.slice(0, maxLines)
  const clipped = allLines.length > maxLines

  if (lines.length === 0) return <Text dimColor>no changes</Text>

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={lineColor(line)} wrap="truncate-end">
          {line || ' '}
        </Text>
      ))}
      {(clipped || truncated) && <Text dimColor>… diff truncated</Text>}
    </Box>
  )
}
