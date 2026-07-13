import { useMemo, useState } from 'react'
import { Box, useApp, useInput } from 'ink'
import { useQueries, useQuery } from '@tanstack/react-query'
import { logQueryOptions, prQueryOptions } from '../query/queries'
import type { PrInfo } from '#src/stack/pr'
import { CreateModal } from './CreateModal'
import { RenameModal } from './RenameModal'
import { TABS, type TabMode } from './Tabs'
import { Header } from './layout/Header'
import { StackPane } from './layout/StackPane'
import { ContentArea } from './layout/ContentArea'
import { StatusBar } from './layout/StatusBar'
import { Legend } from './layout/Legend'
import { HelpOverlay, HELP_LINE_COUNT } from './layout/HelpOverlay'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { useStackData } from '../hooks/useStackData'
import { useStackActions } from '../hooks/useStackActions'

export function App() {
  const { exit } = useApp()
  const { rows } = useTerminalSize()

  const {
    nodes,
    trunk,
    selected,
    setSelected,
    selectedNode,
    currentBranch,
    hasTrackedBranches,
    run,
    busy,
    status,
    statusVariant,
    syncing,
  } = useStackData()
  const actions = useStackActions(run, trunk)

  const [right, setRight] = useState<TabMode>('info')
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [helpScroll, setHelpScroll] = useState(0)
  const [newBranch, setNewBranch] = useState('')

  const logQuery = useQuery(logQueryOptions(selectedNode?.name))
  const log = logQuery.data ?? null

  const trackedNodes = useMemo(
    () => nodes.filter(({ node }) => !node.isTrunk),
    [nodes],
  )
  const prResults = useQueries({
    queries: trackedNodes.map(({ node }) => prQueryOptions(node.name)),
  })
  const prs = useMemo(() => {
    const map: Record<string, PrInfo | null> = {}
    trackedNodes.forEach(({ node }, i) => {
      if (prResults[i]?.data !== undefined) map[node.name] = prResults[i].data!
    })
    return map
  }, [trackedNodes, prResults])

  const doCreate = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !selectedNode) return
    setCreating(false)
    setNewBranch('')
    actions.create(trimmed, selectedNode.name)
  }

  const doRename = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !selectedNode) return
    setRenaming(false)
    setNewBranch('')
    actions.rename(selectedNode.name, trimmed)
  }

  useInput((input, key) => {
    if (key.ctrl && input === 'c') return exit()
    if (creating || renaming) return
    if (showHelp) {
      if (input === '?' || key.escape || input === 'q') {
        setShowHelp(false)
        setHelpScroll(0)
      } else if (key.upArrow || input === 'k') {
        setHelpScroll((s) => Math.max(0, s - 1))
      } else if (key.downArrow || input === 'j') {
        setHelpScroll((s) => Math.min(HELP_LINE_COUNT - 1, s + 1))
      }
      return
    }
    if (busy) return

    if (input === '?') return setShowHelp(true)
    if (input === 'q' || key.escape) return exit()
    if (key.upArrow || input === 'k') {
      setSelected((s) => Math.max(0, s - 1))
    } else if (key.downArrow || input === 'j') {
      setSelected((s) => Math.min(nodes.length - 1, s + 1))
    } else if (key.return || input === 'c') {
      if (selectedNode) actions.checkout(selectedNode.name)
    } else if (key.tab) {
      const idx = TABS.findIndex((t) => t.mode === right)
      const delta = key.shift ? -1 : 1
      setRight(TABS[(idx + delta + TABS.length) % TABS.length].mode)
    } else if (TABS.some((t) => t.key === input)) {
      setRight(TABS.find((t) => t.key === input)!.mode)
    } else if (input === 'o') {
      if (selectedNode && !selectedNode.isTrunk)
        actions.openPr(selectedNode.name)
    } else if (input === 'p') {
      if (selectedNode && !selectedNode.isTrunk) actions.push(selectedNode.name)
    } else if (input === 'P') {
      if (selectedNode && !selectedNode.isTrunk && selectedNode.parent) {
        actions.createPr(selectedNode.name, selectedNode.parent)
      }
    } else if (input === 'r') {
      if (selectedNode) actions.restack(selectedNode.name)
    } else if (input === 'R') {
      run('refreshing…', async () => 'refreshed')
    } else if (input === 'n') {
      if (selectedNode) {
        setNewBranch('')
        setCreating(true)
      }
    } else if (input === 'm') {
      if (selectedNode && !selectedNode.isTrunk) {
        setNewBranch(selectedNode.name)
        setRenaming(true)
      }
    } else if (input === 'F') {
      if (selectedNode) actions.fetch(selectedNode.name, selectedNode.isCurrent)
    } else if (input === 'u') {
      if (selectedNode && !selectedNode.isTrunk)
        actions.untrack(selectedNode.name)
    }
  })

  // The tree sizes to its branches but never takes more than ~40% of the screen;
  // beyond that it scrolls (overflow is clipped and Tree shows "↑/↓ N more").
  const treeMaxHeight = Math.max(4, Math.floor(rows * 0.4))

  const selectedPrIdx =
    selectedNode && !selectedNode.isTrunk
      ? trackedNodes.findIndex(({ node }) => node.name === selectedNode.name)
      : -1
  const selectedPrResult =
    selectedPrIdx >= 0 ? prResults[selectedPrIdx] : undefined
  const prState =
    !selectedNode || selectedNode.isTrunk
      ? undefined
      : selectedPrResult?.isPending
        ? 'loading'
        : (selectedPrResult?.data ?? null)

  return (
    <Box
      flexDirection="column"
      height={rows}
      width="100%"
      paddingX={1}
      paddingY={0}
      margin={0}
    >
      <Header
        trunk={trunk}
        branchCount={nodes.length}
        currentBranch={currentBranch}
      />

      {showHelp ? (
        <HelpOverlay scroll={helpScroll} />
      ) : (
        <>
          <StackPane
            nodes={nodes}
            selected={selected}
            prs={prs}
            syncing={syncing}
            hasTrackedBranches={hasTrackedBranches}
            maxHeight={treeMaxHeight}
          />

          {creating && selectedNode ? (
            <Box
              flexGrow={1}
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <CreateModal
                parent={selectedNode.name}
                value={newBranch}
                onChange={setNewBranch}
                onSubmit={doCreate}
                onCancel={() => setCreating(false)}
              />
            </Box>
          ) : renaming && selectedNode ? (
            <Box
              flexGrow={1}
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <RenameModal
                branch={selectedNode.name}
                value={newBranch}
                onChange={setNewBranch}
                onSubmit={doRename}
                onCancel={() => setRenaming(false)}
              />
            </Box>
          ) : (
            <ContentArea
              right={right}
              selectedNode={selectedNode}
              log={log}
              pr={prState}
            />
          )}
        </>
      )}

      <StatusBar busy={busy} status={status} variant={statusVariant} />

      <Legend isTrunk={selectedNode?.isTrunk ?? true} />
    </Box>
  )
}
