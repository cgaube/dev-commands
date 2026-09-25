import { useMemo, useState, type ReactNode } from 'react'
import { Box, useApp, useInput } from 'ink'
import { useQueries, useQuery } from '@tanstack/react-query'
import { logQueryOptions, prQueryOptions } from '../query/queries'
import type { PrInfo } from '#src/stack/pr'
import { topExistingBranch } from '../rows'
import { InputModal } from './InputModal'
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

// The modal that is open, if any. While a modal is open, it gets all input.
type Modal =
  | { type: 'add'; top: string }
  | { type: 'init'; base?: string }
  | null

// The keys that change a stack.
const STACK_KEYS = new Set(['n', 'r', 'S', 'P'])

const REBASE_HINT =
  'rebase in progress — run gh stack rebase --continue or --abort in a terminal'

function Centered({ children }: { children: ReactNode }) {
  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      {children}
    </Box>
  )
}

export function App({ warning }: { warning: string | null }) {
  const { exit } = useApp()
  const { rows: termRows } = useTerminalSize()

  const {
    state,
    rows,
    selected,
    setSelected,
    selectedRow,
    run,
    busy,
    status,
    statusVariant,
    syncing,
  } = useStackData(warning)
  const actions = useStackActions(run)

  const [right, setRight] = useState<TabMode>('info')
  const [modal, setModal] = useState<Modal>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [helpScroll, setHelpScroll] = useState(0)
  const [input, setInput] = useState('')

  const logQuery = useQuery(logQueryOptions(selectedRow))
  const log = logQuery.data ?? null

  // One PR query for each branch name. A branch is in one stack only.
  const branchNames = useMemo(
    () => [...new Set(rows.filter((r) => r.branch).map((r) => r.name))],
    [rows],
  )
  const prResults = useQueries({
    queries: branchNames.map((name) => prQueryOptions(name)),
  })
  const prs = useMemo(() => {
    const map: Record<string, PrInfo | null> = {}
    branchNames.forEach((name, i) => {
      if (prResults[i]?.data !== undefined) map[name] = prResults[i].data!
    })
    return map
  }, [branchNames, prResults])

  const closeModal = () => {
    setModal(null)
    setInput('')
  }

  const submitInput = (value: string) => {
    const name = value.trim()
    if (!name || !modal) return
    if (modal.type === 'add') actions.add(modal.top, name)
    if (modal.type === 'init') actions.init(name, modal.base)
    closeModal()
  }

  const rebaseInProgress = !!state?.rebaseInProgress

  useInput((key, info) => {
    if (info.ctrl && key === 'c') return exit()
    if (modal) return
    if (showHelp) {
      if (key === '?' || info.escape || key === 'q') {
        setShowHelp(false)
        setHelpScroll(0)
      } else if (info.upArrow || key === 'k') {
        setHelpScroll((s) => Math.max(0, s - 1))
      } else if (info.downArrow || key === 'j') {
        setHelpScroll((s) => Math.min(HELP_LINE_COUNT - 1, s + 1))
      }
      return
    }
    if (busy) return

    if (key === '?') return setShowHelp(true)
    if (key === 'q' || info.escape) return exit()
    if (key === 'N') return setModal({ type: 'init' })
    if (key === 'R') return run('refreshing…', async () => 'refreshed')

    if (info.tab) {
      const idx = TABS.findIndex((t) => t.mode === right)
      const delta = info.shift ? -1 : 1
      return setRight(TABS[(idx + delta + TABS.length) % TABS.length].mode)
    }
    if (TABS.some((t) => t.key === key)) {
      return setRight(TABS.find((t) => t.key === key)!.mode)
    }
    if (info.upArrow || key === 'k') {
      return setSelected((s) => Math.max(0, s - 1))
    }
    if (info.downArrow || key === 'j') {
      return setSelected((s) => Math.min(rows.length - 1, s + 1))
    }

    if (!selectedRow) return
    const { branch, stack, stacks } = selectedRow

    if (info.return || key === 'c') return actions.checkout(selectedRow.name)
    if (key === 'o' && branch) return actions.openPr(branch.name)

    // A conflict needs a person. The TUI does not change the stacks until
    // the rebase is done in a terminal.
    if (STACK_KEYS.has(key) && rebaseInProgress) {
      return actions.notice(REBASE_HINT)
    }

    // On a trunk row, a stack key acts on all the stacks of the trunk.
    if (!branch || !stack) {
      if (key === 'n') setModal({ type: 'init', base: selectedRow.name })
      else if (key === 'r') actions.rebase(stacks)
      else if (key === 'S') actions.sync(stacks)
      else if (key === 'P') {
        actions.notice('select a branch — P acts on one stack')
      }
      return
    }

    if (key === 'n') {
      const top = stack.branches.at(-1)?.name
      if (top) setModal({ type: 'add', top })
    } else if (key === 'r') actions.rebase([stack])
    else if (key === 'S') actions.sync([stack])
    else if (key === 'P') {
      // Submit checks out a branch of the stack first. When the selected
      // branch does not exist locally, use the top branch of the stack.
      const target = branch.exists ? branch.name : topExistingBranch(stack)
      if (target) actions.submit(target)
    }
  })

  // The stack list gets the height of its lines, but not more than ~40% of
  // the screen. Then it scrolls.
  const listMaxHeight = Math.max(4, Math.floor(termRows * 0.4))

  const selectedPrIdx = selectedRow?.branch
    ? branchNames.indexOf(selectedRow.name)
    : -1
  const selectedPrResult =
    selectedPrIdx >= 0 ? prResults[selectedPrIdx] : undefined
  const prState = !selectedRow?.branch
    ? undefined
    : selectedPrResult?.isPending
      ? 'loading'
      : (selectedPrResult?.data ?? null)

  let middle: ReactNode
  if (modal?.type === 'add') {
    middle = (
      <InputModal
        title="Add branch"
        context={['on top of', modal.top]}
        label="name"
        value={input}
        onChange={setInput}
        onSubmit={submitInput}
        onCancel={closeModal}
      />
    )
  } else if (modal?.type === 'init') {
    middle = (
      <InputModal
        title="New stack"
        context={['base', modal.base ?? 'default branch']}
        label="first branch"
        value={input}
        onChange={setInput}
        onSubmit={submitInput}
        onCancel={closeModal}
      />
    )
  }

  return (
    <Box
      flexDirection="column"
      height={termRows}
      width="100%"
      paddingX={1}
      paddingY={0}
      margin={0}
    >
      <Header
        stackCount={state?.stacks.length ?? 0}
        currentBranch={state?.currentBranch}
      />

      {showHelp ? (
        <HelpOverlay scroll={helpScroll} />
      ) : (
        <>
          <StackPane
            rows={rows}
            selected={selected}
            prs={prs}
            syncing={syncing}
            maxHeight={listMaxHeight}
          />

          {middle ? (
            <Centered>{middle}</Centered>
          ) : (
            <ContentArea
              right={right}
              selectedRow={selectedRow}
              log={log}
              pr={prState}
            />
          )}
        </>
      )}

      <StatusBar busy={busy} status={status} variant={statusVariant} />

      <Legend hasStacks={rows.length > 0} rebaseInProgress={rebaseInProgress} />
    </Box>
  )
}
