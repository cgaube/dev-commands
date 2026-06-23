import { Box, Text } from 'ink'
import type { StackNode } from '#src/stack/graph'
import type { PrInfo } from '#src/stack/pr'
import type { BranchLog } from '#src/stack/log'
import { Tabs, type TabMode } from '../Tabs'
import { DiffPane } from '../DiffPane'
import { LogPane } from '../LogPane'
import { InfoPane } from '../InfoPane'
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight'

type PrState = PrInfo | null | 'loading' | undefined

type Props = {
  right: TabMode
  selectedNode?: StackNode
  diff: { text: string; truncated: boolean } | null
  log: BranchLog | null
  pr: PrState
}

// The right-hand tabbed panel (info / diff / log). Measures its own content box
// so the diff and log panes know how many lines they may render.
export function ContentArea({ right, selectedNode, diff, log, pr }: Props) {
  const [paneRef, paneLines] = useMeasuredHeight()

  let content
  if (right === 'diff') {
    content = selectedNode?.isTrunk ? (
      <Text dimColor>empty</Text>
    ) : diff ? (
      <DiffPane
        diff={diff.text}
        truncated={diff.truncated}
        maxLines={paneLines}
      />
    ) : (
      <Text dimColor>loading…</Text>
    )
  } else if (right === 'log') {
    content = log ? (
      <LogPane log={log} maxLines={paneLines} />
    ) : (
      <Text dimColor>loading…</Text>
    )
  } else {
    content = <InfoPane node={selectedNode} pr={pr} />
  }

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      minHeight={0}
      overflow="hidden"
    >
      <Tabs active={right} />
      <Box
        ref={paneRef}
        marginTop={1}
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        overflow="hidden"
      >
        {content}
      </Box>
    </Box>
  )
}
