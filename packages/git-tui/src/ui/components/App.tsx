import { useMemo, useState, type ReactNode } from 'react'
import { Box, useApp, useInput } from 'ink'
import { useQuery } from '@tanstack/react-query'
import { logQueryOptions, prsQueryOptions } from '../query/queries'
import type { PrInfo } from '#src/stack/pr'
import type { Branch } from '#src/stack/model'
import { topExistingBranch } from '../rows'
import { InputModal } from './InputModal'
import { ConfirmModal, type Choice } from './ConfirmModal'
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
  | { type: 'init'; base: string }
  | { type: 'branch'; base: string }
  | { type: 'promote'; branch: string; base: string }
  | {
      type: 'confirm'
      title: string
      message: string
      choices: Choice[]
      onChoose: (key: string) => void
    }
  | null

// The keys that change a branch or a stack.
const CHANGE_KEYS = new Set(['n', 'r', 'S', 'P', 'p', 'd'])

// The terminal width at which the stack list and the content go side by side.
const WIDE_MIN_COLS = 120

// The terminal width at which the stack list takes about a third of the width,
// not half, and the content gets the rest.
const VERY_WIDE_MIN_COLS = 150

// The legend shows how to finish the rebase.
const REBASE_HINT = 'finish the rebase first'

// GitHub does not open a PR for a branch without commits after its parent,
// and gh stack then pushes without a PR, with no error. Find such a branch
// before a submit. A merged branch, a branch that is gone, or a branch with a
// PR needs no new PR.
function emptyBranch(branches: Branch[]): string | null {
  const empty = branches.find(
    (b) => !b.isMerged && b.exists && !b.prNumber && b.ahead === 0,
  )
  return empty
    ? `${empty.name} has no commits after ${empty.parent} — commit first`
    : null
}

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
  const { cols: termCols, rows: termRows } = useTerminalSize()

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

  // The PRs of all the branches come from one query.
  const prsQuery = useQuery(prsQueryOptions())
  const prs = useMemo(() => {
    const map: Record<string, PrInfo | null> = {}
    if (!prsQuery.data) return map
    for (const row of rows) {
      if (row.branch) map[row.name] = prsQuery.data.get(row.name) ?? null
    }
    return map
  }, [rows, prsQuery.data])

  // All the inputs ask for a branch name. A branch name cannot contain
  // spaces, so show them as "-" while the user types. Drop the leading
  // spaces: git does not accept a name that starts with "-".
  const changeBranchName = (value: string) =>
    setInput(value.replace(/^\s+/, '').replace(/\s+/g, '-'))

  const closeModal = () => {
    setModal(null)
    setInput('')
  }

  const submitInput = (value: string) => {
    const name = value.trim()
    if (!name || !modal) return
    if (modal.type === 'add') actions.add(modal.top, name)
    if (modal.type === 'init') actions.init(name, modal.base)
    if (modal.type === 'branch') actions.createBranch(name, modal.base)
    if (modal.type === 'promote') {
      actions.promote(modal.branch, name, modal.base)
    }
    closeModal()
  }

  // Delete a plain branch. Ask first, and offer origin's copy when it
  // exists. When git refuses a branch that is not merged, ask again before
  // a force delete.
  const confirmDelete = (branch: Branch) => {
    const pr = prs[branch.name]
    const choices: Choice[] = [['y', 'delete']]
    if (branch.hasRemote)
      choices.push(['a', `also delete origin/${branch.name}`])
    setModal({
      type: 'confirm',
      title: 'Delete branch',
      message: `delete ${branch.name}?`,
      choices,
      onChoose: (key) => {
        closeModal()
        const remote = key === 'a'
        actions.deleteBranch(branch.name, {
          force: false,
          remote,
          onNotMerged: () =>
            setModal({
              type: 'confirm',
              title: 'Force delete',
              message: `${branch.name} is not merged into ${branch.parent}${pr ? ` (PR #${pr.number} is ${pr.state.toLowerCase()})` : ''}. Delete it and its commits?`,
              choices: [['y', 'force delete']],
              onChoose: () => {
                closeModal()
                actions.deleteBranch(branch.name, {
                  force: true,
                  remote,
                  onNotMerged: () => {},
                })
              },
            }),
        })
      },
    })
  }

  const rebase = state?.rebase ?? null

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

    // Moving around works while an operation runs. The keys below it wait.
    if (key === '?') return setShowHelp(true)
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
    if (busy) return

    if (key === 'q' || info.escape) return exit()
    if (key === 'N' && state) {
      return setModal({ type: 'branch', base: state.defaultBranch })
    }
    if (key === 'R') return run('refreshing…', async () => 'refreshed')

    if (!selectedRow) return
    const { kind, branch, stack, stacks } = selectedRow

    if (info.return || key === 'c') {
      // Sync deletes the local branch of a merged PR, but the tree keeps it.
      if (branch && !branch.exists) {
        return actions.notice(`${branch.name} does not exist locally`)
      }
      return actions.checkout(selectedRow.name)
    }
    if (key === 'o' && branch) return actions.openPr(branch.name)

    // A conflict needs a person. Until the rebase is done, r continues it,
    // and the other keys that change branches do nothing.
    if (CHANGE_KEYS.has(key) && rebase) {
      if (key === 'r') return actions.continueRebase(rebase)
      return actions.notice(REBASE_HINT)
    }

    // A plain branch is not in a stack. Its parent is the default branch.
    if (kind === 'plain' && branch) {
      if (key === 'P' || key === 'p') {
        if (!branch.ahead) {
          return actions.notice(`no commits after ${branch.parent}`)
        }
        const pr = prs[branch.name]
        actions.createPr(branch.name, branch.parent, pr?.state === 'OPEN')
      } else if (key === 'n') {
        setModal({ type: 'promote', branch: branch.name, base: branch.parent })
      } else if (key === 'd') {
        if (branch.isCurrent) {
          return actions.notice('check out another branch first')
        }
        confirmDelete(branch)
      } else if (key === 'r') {
        if (!branch.needsRebase) {
          return actions.notice(
            `${branch.name} is up to date with ${branch.parent}`,
          )
        }
        actions.rebasePlain(branch.name, branch.parent)
      } else if (key === 'S') {
        actions.notice('not a stack — r rebases, p pushes')
      }
      return
    }

    if (key === 'd') {
      return actions.notice(
        kind === 'trunk'
          ? 'cannot delete a trunk'
          : 'a stack branch — use gh stack to remove it',
      )
    }

    // On a trunk row, a stack key acts on all the stacks of the trunk.
    if (!branch || !stack) {
      // New work starts as a plain branch from the default branch. Another
      // trunk has only stacks, so n starts a stack there.
      if (key === 'n') {
        const base = selectedRow.name
        setModal(
          base === state?.defaultBranch
            ? { type: 'branch', base }
            : { type: 'init', base },
        )
      } else if (key === 'r') actions.rebase(stacks)
      else if (key === 'S') actions.sync(stacks, selectedRow.name)
      else if (key === 'P' || key === 'p') {
        actions.notice(`select a branch — ${key} acts on one stack`)
      }
      return
    }

    if (key === 'n') {
      const top = stack.branches.at(-1)?.name
      if (top) setModal({ type: 'add', top })
    } else if (key === 'r') actions.rebase([stack])
    else if (key === 'S') actions.sync([stack])
    else if (key === 'P') {
      const empty = emptyBranch(stack.branches)
      if (empty) return actions.notice(empty)
      // Submit checks out a branch of the stack first. When the selected
      // branch does not exist locally, use the top branch of the stack.
      const target = branch.exists ? branch.name : topExistingBranch(stack)
      if (target) actions.submit(target)
    } else if (key === 'p') {
      if (branch.isMerged) return actions.notice(`${branch.name} is merged`)
      const end = stack.branches.indexOf(branch)
      const empty = emptyBranch(stack.branches.slice(0, end + 1))
      if (empty) return actions.notice(empty)
      const target = branch.exists ? branch.name : topExistingBranch(stack)
      if (target) actions.submitUpTo(stack, target, branch.name)
    }
  })

  // The stack list gets the height of its lines, but not more than ~40% of
  // the screen. Then it scrolls.
  // On a wide terminal, the stack list and the content sit side by side and
  // the list uses the full height.
  const wide = termCols >= WIDE_MIN_COLS
  const listMaxHeight = wide
    ? undefined
    : Math.max(4, Math.floor(termRows * 0.4))

  const prState = !selectedRow?.branch
    ? undefined
    : prsQuery.isPending
      ? 'loading'
      : (prs[selectedRow.name] ?? null)

  let middle: ReactNode
  if (modal?.type === 'add') {
    middle = (
      <InputModal
        title="Add branch"
        context={['after', modal.top]}
        label="name"
        value={input}
        onChange={changeBranchName}
        onSubmit={submitInput}
        onCancel={closeModal}
      />
    )
  } else if (modal?.type === 'init') {
    middle = (
      <InputModal
        title="New stack"
        context={['base', modal.base]}
        label="first branch"
        value={input}
        onChange={changeBranchName}
        onSubmit={submitInput}
        onCancel={closeModal}
      />
    )
  } else if (modal?.type === 'branch') {
    middle = (
      <InputModal
        title="New branch"
        context={['from', modal.base]}
        label="name"
        value={input}
        onChange={changeBranchName}
        onSubmit={submitInput}
        onCancel={closeModal}
      />
    )
  } else if (modal?.type === 'promote') {
    middle = (
      <InputModal
        title="New stack"
        context={['after', modal.branch]}
        label="name"
        value={input}
        onChange={changeBranchName}
        onSubmit={submitInput}
        onCancel={closeModal}
      />
    )
  } else if (modal?.type === 'confirm') {
    middle = (
      <ConfirmModal
        title={modal.title}
        message={modal.message}
        choices={modal.choices}
        onChoose={modal.onChoose}
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
        branchCount={state?.branches.length ?? 0}
        currentBranch={state?.currentBranch}
      />

      {showHelp ? (
        <HelpOverlay scroll={helpScroll} />
      ) : (
        <Box flexGrow={1} flexDirection={wide ? 'row' : 'column'} minHeight={0}>
          <StackPane
            rows={rows}
            selected={selected}
            prs={prs}
            syncing={syncing}
            maxHeight={listMaxHeight}
            width={
              !wide ? undefined : termCols >= VERY_WIDE_MIN_COLS ? '35%' : '50%'
            }
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
        </Box>
      )}

      <StatusBar busy={busy} status={status} variant={statusVariant} />

      <Legend kind={selectedRow?.kind} rebase={rebase} />
    </Box>
  )
}
