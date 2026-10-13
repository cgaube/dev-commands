import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { Row } from '../../rows'
import type { PrInfo } from '#src/stack/pr'
import type { BranchLog } from '#src/stack/log'
import { Tabs, type TabMode } from '../Tabs'
import { LogPane } from '../LogPane'
import { InfoPane } from '../InfoPane'
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight'

type PrState = PrInfo | null | 'loading' | undefined

type Props = {
  right: TabMode
  selectedRow?: Row
  log: BranchLog | null
  pr: PrState
}

// The pane height at which Info and Log show one below the other, without
// tabs. Info takes up to 8 lines, the Log title 2, and the log gets at least
// 8 lines.
const STACKED_MIN_LINES = 18

function LogContent({
  log,
  maxLines,
  selectedRow,
}: {
  log: BranchLog | null
  maxLines: number
  selectedRow?: Row
}) {
  if (!log) {
    return (
      <Box gap={1}>
        <Spinner />
        <Text dimColor>loading…</Text>
      </Box>
    )
  }
  return (
    <LogPane
      log={log}
      maxLines={maxLines}
      needsRebase={!!selectedRow?.branch?.needsRebase}
      plain={selectedRow?.kind === 'plain'}
    />
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text bold color="cyan">
      {children}
    </Text>
  )
}

// The right panel. With enough height, Info and Log show one below the
// other. Otherwise they are tabs. The first line is the tab strip or the Info
// title, so the pane has the same height in both layouts.
export function ContentArea({ right, selectedRow, log, pr }: Props) {
  const [paneRef, paneLines] = useMeasuredHeight()
  const [logRef, logLines] = useMeasuredHeight()
  const stacked = paneLines >= STACKED_MIN_LINES

  let content
  if (stacked) {
    content = (
      <>
        <InfoPane row={selectedRow} pr={pr} />
        <Box marginTop={1}>
          <SectionTitle>Log</SectionTitle>
        </Box>
        <Box
          ref={logRef}
          marginTop={1}
          flexDirection="column"
          flexGrow={1}
          minHeight={0}
          overflow="hidden"
        >
          <LogContent log={log} maxLines={logLines} selectedRow={selectedRow} />
        </Box>
      </>
    )
  } else if (right === 'log') {
    content = (
      <LogContent log={log} maxLines={paneLines} selectedRow={selectedRow} />
    )
  } else {
    content = <InfoPane row={selectedRow} pr={pr} />
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
      {stacked ? <SectionTitle>Info</SectionTitle> : <Tabs active={right} />}
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
