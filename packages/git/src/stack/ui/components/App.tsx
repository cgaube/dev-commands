import { useEffect, useRef, useState } from 'react'
import { Box, useApp, useInput } from 'ink'
import { branchLog } from '#src/stack/log'
import { branchPr, type PrInfo } from '#src/stack/pr'
import { CreateModal } from './CreateModal'
import { TABS, type TabMode } from './Tabs'
import { Header } from './layout/Header'
import { StackPane } from './layout/StackPane'
import { ContentArea } from './layout/ContentArea'
import { StatusBar } from './layout/StatusBar'
import { Legend } from './layout/Legend'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { useBranchPane } from '../hooks/useBranchPane'
import { useStackData } from '../hooks/useStackData'
import { useStackActions } from '../hooks/useStackActions'

export function App() {
  const { exit } = useApp()
  const { cols, rows } = useTerminalSize()

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
  const [prs, setPrs] = useState<Record<string, PrInfo | null>>({})
  const [creating, setCreating] = useState(false)
  const [newBranch, setNewBranch] = useState('')

  const prFetchedRef = useRef(new Set<string>())

  const log = useBranchPane(right === 'log', selectedNode?.name, branchLog)

  // PRs for every tracked branch are fetched in bulk below whenever the node
  // list changes, so the info pane reads from `prs` without its own fetch.
  useEffect(() => {
    for (const { node } of nodes) {
      if (node.isTrunk || prFetchedRef.current.has(node.name)) continue
      prFetchedRef.current.add(node.name)
      branchPr(node.name).then((info) => {
        setPrs((m) => ({ ...m, [node.name]: info }))
      })
    }
  }, [nodes])

  const doCreate = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !selectedNode) return
    setCreating(false)
    setNewBranch('')
    actions.create(trimmed, selectedNode.name)
  }

  useInput((input, key) => {
    if (key.ctrl && input === 'c') return exit()
    if (creating) return
    if (busy) return

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
      actions.restack()
    } else if (input === 's') {
      actions.sync()
    } else if (input === 'R') {
      setPrs({})
      prFetchedRef.current.clear()
      run('refreshing…', async () => 'refreshed')
    } else if (input === 'n') {
      if (selectedNode) {
        setNewBranch('')
        setCreating(true)
      }
    }
  })

  // The tree sizes to its branches but never takes more than ~40% of the screen;
  // beyond that it scrolls (overflow is clipped and Tree shows "↑/↓ N more").
  const treeMaxHeight = Math.max(4, Math.floor(rows * 0.4))

  // Inner width available for tree content (inside border + paddingX=1).
  const innerWidth = cols - 4 // 2 border chars + 2 padding chars

  const prState =
    !selectedNode || selectedNode.isTrunk
      ? undefined
      : selectedNode.name in prs
        ? prs[selectedNode.name]
        : 'loading'

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

      <StackPane
        nodes={nodes}
        selected={selected}
        prs={prs}
        syncing={syncing}
        hasTrackedBranches={hasTrackedBranches}
        maxHeight={treeMaxHeight}
        innerWidth={innerWidth}
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
      ) : (
        <ContentArea
          right={right}
          selectedNode={selectedNode}
          log={log}
          pr={prState}
        />
      )}

      <StatusBar busy={busy} status={status} variant={statusVariant} />

      <Legend />
    </Box>
  )
}
