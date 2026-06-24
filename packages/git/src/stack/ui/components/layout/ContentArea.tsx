import { Box, Text } from 'ink'
import type { StackNode } from '#src/stack/graph'
import type { PrInfo } from '#src/stack/pr'
import type { BranchLog } from '#src/stack/log'
import { Tabs, type TabMode } from '../Tabs'
import { LogPane } from '../LogPane'
import { InfoPane } from '../InfoPane'
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight'

type PrState = PrInfo | null | 'loading' | undefined

type Props = {
  right: TabMode
  selectedNode?: StackNode
  log: BranchLog | null
  pr: PrState
}

export function ContentArea({ right, selectedNode, log, pr }: Props) {
  const [paneRef, paneLines] = useMeasuredHeight()

  let content
  if (right === 'log') {
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
