import { basename, dirname } from 'path'
import { useEffect, useRef, useState } from 'react'
import { useIsFetching, useMutation, useQuery } from '@tanstack/react-query'
import type { KeyEvent } from '@opentui/core'
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react'
import * as actions from '#src/actions'
import { autoResolve } from '#src/autoResolve'
import type { AgentRun } from '#src/claude'
import { saveTheme } from '#src/config'
import type { Model, Row } from '#src/data/model'
import { AgentPanel, type AgentState } from './AgentPanel'
import { BranchList } from './BranchList'
import { Details, FoldDetails, RebaseBanner } from './Details'
import { Header, HEADER_HEIGHT } from './Header'
import { Help } from './Help'
import { foldKey, listItems, stackKey, type Fold, type Item } from './listItems'
import { HintBar, hintsWidth, type HintItem } from './Kbd'
import { Modal, type Severity } from './Modal'
import { keys, modelQuery, prsQuery, queryClient, type PrMap } from './query'
import { applyTheme, color, THEME_IDS, themeLabel, type ThemeId } from './theme'
import { ThemePicker } from './ThemePicker'
import { useGitWatch } from './useGitWatch'

type Mode =
  | { type: 'list' }
  | { type: 'help' }
  // The theme picker. `saved` is the theme to restore on cancel.
  | { type: 'theme'; saved: ThemeId }
  // A question in a modal. See Modal.
  | {
      type: 'input'
      title: string
      label: string
      onSubmit: (value: string) => void
    }
  | {
      type: 'confirm'
      severity: Severity
      title: string
      text: string
      // The keys that answer. Never `return`: enter must not confirm by
      // mistake. Any other key cancels.
      choices: Record<string, { label: string; run: () => void }>
    }

type Status = { text: string; variant: 'info' | 'success' | 'error' }

type Action = { label: string; fn: () => Promise<string> }

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// The footer shows the key hints and the status on one line when they fit.
// Else it uses two lines: the status, then the hints. Prompts always use
// two lines.
const MIN_STATUS_WIDTH = 30
// The opacity of the panes behind a modal.
const DIMMED = 0.35
// The empty cells around the panes and the footer.
const MARGIN = 1

// The terminal width under which the details go below the list.
const NARROW = 100

// One name for a key press: the printed character when there is one (so
// that "R" and "?" work), else the key name, for example "return".
function keyName(key: KeyEvent): string {
  if (key.ctrl) return `ctrl+${key.name}`
  const s = key.sequence
  if (s && s.length === 1 && s >= ' ' && s <= '~') return s
  if (key.name.length === 1 && key.shift) return key.name.toUpperCase()
  return key.name
}

function useSpinner(active: boolean) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80)
    return () => clearInterval(id)
  }, [active])
  return active ? SPINNER[frame] : ' '
}

// True when all the branches of the stack of the row are merged or gone.
// Then the stack has nothing left to do, and `d` removes it.
function stackFinished(row: Row, model: Model, prs: PrMap | undefined) {
  if (!row.stack) return false
  return row.stack.branches.every((name) => {
    const other = model.rows.find((r) => r.name === name)
    return !other?.exists || other.merged || prs?.[name]?.status === 'merged'
  })
}

// The keys to show in the footer for the selected row.
function hints(
  row: Row | undefined,
  fold: Fold | undefined,
  open: Set<string>,
  model: Model,
  agentEnabled: boolean,
  prs: PrMap | undefined,
): HintItem[] {
  const h = (key: string, label: string) => ({ key, label })
  const undo = model.undo ? [h('u', `undo ${model.undo.label}`)] : []
  if (model.repo.rebase) {
    const fix =
      model.repo.conflicts.length && agentEnabled
        ? [h('a', 'fix with Claude')]
        : []
    return [
      ...fix,
      h('c', 'continue'),
      h('A', 'abort'),
      ...undo,
      h('?', 'help'),
    ]
  }
  if (fold) {
    // The next step for the stack, as the details pane tells it.
    const next = fold.rows.some((r) => r.exists)
      ? [h('S', 'sync')]
      : stackFinished(fold.rows[0], model, prs)
        ? [h('d', 'remove finished stack')]
        : []
    return [
      h('return', 'show merged'),
      ...next,
      h('R', 'reload'),
      h('?', 'help'),
    ]
  }
  if (!row) return [h('?', 'help'), h('q', 'quit')]
  if (row.kind === 'trunk') {
    return [
      h('n', 'new branch'),
      h('S', 'update'),
      h('R', 'reload'),
      h('?', 'help'),
      h('q', 'quit'),
    ]
  }
  // A branch that does not exist locally (merged, and deleted by sync)
  // cannot be checked out, pushed or rebased.
  const local = row.exists
  // An open fold: z folds the merged branches again.
  const refold =
    row.stack && open.has(row.stack.branches[0]) ? [h('z', 'fold merged')] : []
  const common = [
    ...refold,
    ...undo,
    ...(local ? [h('return', 'checkout')] : []),
    h('o', 'PR'),
    h('R', 'reload'),
    h('?', 'help'),
  ]
  if (row.stack && stackFinished(row, model, prs)) {
    return [h('d', 'remove finished stack'), ...common]
  }
  if (row.stack) {
    return [
      h('s', 'add on top'),
      ...(local ? [h('p', 'submit')] : []),
      h('S', 'sync'),
      ...(local ? [h('r', 'rebase')] : []),
      ...common,
    ]
  }
  return [
    h('p', 'push'),
    h('s', 'make stack'),
    h('r', 'rebase'),
    h('d', 'delete'),
    ...common,
  ]
}

export function App({
  onQuit,
  initialTheme,
  agentEnabled,
}: {
  onQuit: () => void
  initialTheme: ThemeId
  // True when Claude can fix the conflicts. See src/claude.ts.
  agentEnabled: boolean
}) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const model = useQuery(modelQuery)
  const fetching = useIsFetching() > 0

  const [theme, setTheme] = useState(initialTheme)
  // Show a theme. The components read the colors when they render, so the
  // state change shows the new colors.
  const showTheme = (id: ThemeId) => {
    setTheme(applyTheme(id))
    renderer.setBackgroundColor(color.background)
  }
  const openThemePicker = () => setMode({ type: 'theme', saved: theme })
  // Use the theme, and save it for the next start.
  const pickTheme = (id: ThemeId) => {
    showTheme(id)
    setMode({ type: 'list' })
    setStatus({ text: `theme: ${themeLabel(id)}`, variant: 'success' })
    saveTheme(id).catch((error) =>
      setStatus({
        text: `theme not saved: ${error.message}`,
        variant: 'error',
      }),
    )
  }

  const [selected, setSelected] = useState<string>()
  const [mode, setMode] = useState<Mode>({ type: 'list' })
  const [status, setStatus] = useState<Status>({
    text: 'loading…',
    variant: 'info',
  })

  const data = model.data
  const prs = useQuery(prsQuery(data))
  // The stacks of which the fold of merged branches is open.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  // The items that the keyboard moves through: branches and folds.
  const items = data ? listItems(data.sections, prs.data, open) : []
  const index = Math.max(
    0,
    items.findIndex((item) => item.key === selected),
  )
  const item = items[index] as Item | undefined
  const row = item?.type === 'row' ? item.row : undefined
  const fold = item?.type === 'fold' ? item.fold : undefined

  // Select the current branch on the first load. When the selected branch
  // goes away, e.g. after a delete, select the row at the same position.
  const lastIndex = useRef(0)
  useEffect(() => {
    if (!data) return
    if (selected === undefined) {
      setSelected(data.repo.currentBranch || data.repo.defaultBranch)
      setStatus({ text: 'ready', variant: 'success' })
    } else if (!items.some((i) => i.key === selected)) {
      // A selected branch can be in a fold now, after its PR merged.
      const inFold = items.find(
        (i) =>
          i.type === 'fold' && i.fold.rows.some((r) => r.name === selected),
      )
      setSelected(
        inFold?.key ??
          items[Math.min(lastIndex.current, items.length - 1)]?.key,
      )
    }
  }, [data, prs.data, open])
  lastIndex.current = index

  useEffect(() => {
    if (model.error)
      setStatus({ text: String(model.error.message), variant: 'error' })
  }, [model.error])

  // Reload the git data after each action. Reload the PRs in the background:
  // GitHub is slow, and the keys must not wait for it.
  const action = useMutation({
    mutationFn: (a: Action) => a.fn(),
    onMutate: (a) => setStatus({ text: a.label, variant: 'info' }),
    onSuccess: (text) => setStatus({ text, variant: 'success' }),
    onError: (error) => setStatus({ text: error.message, variant: 'error' }),
    onSettled: async () => {
      void queryClient.invalidateQueries({ queryKey: keys.prs })
      await queryClient.invalidateQueries({ queryKey: ['git'] })
    },
  })
  const busy = action.isPending
  const runAction = (label: string, fn: () => Promise<string>) => {
    if (!busy) action.mutate({ label, fn })
  }

  const busyRef = useRef(busy)
  busyRef.current = busy
  useGitWatch(data?.repo.gitDir, data?.repo.commonDir, () => {
    // An action reloads when it completes.
    if (!busyRef.current)
      void queryClient.invalidateQueries({ queryKey: ['git'] })
  })

  const spinner = useSpinner(busy || fetching)

  // The Claude fix. The panel stays after the fix, until the user closes
  // it, so that the user can read the summaries.
  const [agent, setAgent] = useState<AgentState | null>(null)
  const agentRun = useRef<AgentRun | null>(null)
  const startAutoResolve = () => {
    setAgent({ status: 'running', steps: [], summaries: [] })
    const addStep = (kind: 'round' | 'step', text: string) =>
      setAgent((a) => a && { ...a, steps: [...a.steps, { kind, text }] })
    runAction('Claude is fixing the conflicts…', async () => {
      try {
        const message = await autoResolve({
          onRound: (round, files) =>
            addStep('round', `conflict ${round}: ${files.join(', ')}`),
          onStep: (text) => addStep('step', text),
          onSummary: (summary) =>
            setAgent(
              (a) => a && { ...a, summaries: [...a.summaries, summary] },
            ),
          onRun: (run) => {
            agentRun.current = run
          },
        })
        setAgent((a) => a && { ...a, status: 'done', message })
        return message
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setAgent((a) => a && { ...a, status: 'failed', message })
        throw error
      }
    })
  }
  const confirmUndo = () => {
    const undo = data?.undo
    if (!undo) return setStatus({ text: 'nothing to undo', variant: 'error' })
    setMode({
      type: 'confirm',
      severity: 'warning',
      title: `Undo the last ${undo.label}`,
      text: `Move ${Object.keys(undo.branches).join(', ')} back to where they were before the ${undo.label}. When the ${undo.label} was pushed, push again after the undo.`,
      choices: {
        y: {
          label: 'undo',
          run: () => {
            setAgent(null)
            runAction('undoing…', () => actions.undo(data.repo))
          },
        },
      },
    })
  }

  const inputValue = useRef('')
  const ask = (
    title: string,
    label: string,
    onSubmit: (value: string) => void,
  ) => {
    inputValue.current = ''
    setMode({ type: 'input', title, label, onSubmit })
  }

  const confirmDelete = (target: Row) => {
    const del = (force: boolean, remote: boolean) => () =>
      runAction(`deleting ${target.name}…`, async () => {
        try {
          return await actions.deleteBranch(target, { force, remote })
        } catch (error) {
          if (error instanceof actions.NotMergedError) {
            setMode({
              type: 'confirm',
              severity: 'error',
              title: 'Branch not merged',
              text: `${error.message} Git does not see a squash merge, so a squash-merged branch also shows here. When it is not merged, its commits are lost.`,
              choices: { y: { label: 'force delete', run: del(true, remote) } },
            })
            return 'not deleted'
          }
          throw error
        }
      })
    const choices: Record<string, { label: string; run: () => void }> = {
      y: { label: 'local', run: del(false, false) },
    }
    if (target.hasRemote)
      choices.a = { label: 'local + origin', run: del(false, true) }
    setMode({
      type: 'confirm',
      severity: 'error',
      title: 'Delete branch',
      text: target.hasRemote
        ? `Delete ${target.name}? Press a to also delete origin/${target.name}.`
        : `Delete ${target.name}?`,
      choices,
    })
  }

  // Handle one key press. A click on a key cap or a row calls it too.
  const handleKey = (k: string) => {
    if (k === 'ctrl+c') {
      agentRun.current?.cancel()
      return onQuit()
    }
    if (k === 'escape' && agent && mode.type === 'list') {
      if (agentRun.current) agentRun.current.cancel()
      else setAgent(null)
      return
    }

    if (mode.type === 'input') {
      if (k === 'escape') setMode({ type: 'list' })
      return
    }
    if (mode.type === 'confirm') {
      const choice = mode.choices[k]
      setMode({ type: 'list' })
      choice?.run()
      return
    }
    if (mode.type === 'theme') {
      const i = THEME_IDS.indexOf(theme)
      const n = THEME_IDS.length
      switch (k) {
        case 'up':
        case 'k':
          return showTheme(THEME_IDS[(i - 1 + n) % n])
        case 'down':
        case 'j':
          return showTheme(THEME_IDS[(i + 1) % n])
        case 'return':
          return pickTheme(theme)
        case 'escape':
        case 'q':
        case 't':
          showTheme(mode.saved)
          return setMode({ type: 'list' })
      }
      return
    }
    if (mode.type === 'help') {
      if (k === '?' || k === 'escape' || k === 'q') setMode({ type: 'list' })
      return
    }

    // Move from the latest selection, not from the one of this render: two
    // fast key presses come before the next render.
    const moveBy = (delta: number) =>
      setSelected((current) => {
        const at = Math.max(
          0,
          items.findIndex((i) => i.key === current),
        )
        const next = items[Math.max(0, Math.min(items.length - 1, at + delta))]
        return next?.key ?? current
      })
    const moveTo = (to: number) => {
      const next = items[Math.max(0, Math.min(items.length - 1, to))]
      if (next) setSelected(next.key)
    }
    switch (k) {
      case 'q':
      case 'escape':
        return onQuit()
      case 'up':
      case 'k':
        return moveBy(-1)
      case 'down':
      case 'j':
        return moveBy(1)
      case 'g':
        return moveTo(0)
      case 'G':
        return moveTo(items.length - 1)
      case '?':
        return setMode({ type: 'help' })
      case 't':
        return openThemePicker()
      case 'R':
        setStatus({ text: 'reloading…', variant: 'info' })
        void queryClient.invalidateQueries()
        return
    }
    if (!data || busy) return
    const repo = data.repo
    const pr = row ? prs.data?.[row.name] : undefined

    // While a rebase stopped, only the rebase keys work. Other actions would
    // act on a half-rebased branch.
    if (repo.rebase) {
      switch (k) {
        case 'a':
          if (!agentEnabled) {
            return setStatus({
              text: 'Claude fix is off: edit the files, git add them, then press c',
              variant: 'error',
            })
          }
          if (!repo.conflicts.length) return
          return startAutoResolve()
        case 'u':
          return confirmUndo()
        case 'c':
          return runAction('continuing the rebase…', () =>
            actions.continueRebase(repo.rebase),
          )
        case 'A':
          return setMode({
            type: 'confirm',
            severity: 'warning',
            title: 'Abort rebase',
            text: 'Stop the rebase and restore the branches as they were before it. The conflict fixes are lost.',
            choices: {
              y: {
                label: 'abort',
                run: () =>
                  runAction('aborting…', () =>
                    actions.abortRebase(repo.rebase),
                  ),
              },
            },
          })
        case 'o':
          return runAction('opening the PR…', () => actions.openPr(pr))
      }
      setStatus({
        text: agentEnabled
          ? 'finish the rebase first: a, c or A'
          : 'finish the rebase first: c or A',
        variant: 'error',
      })
      return
    }

    // A fold: enter or z opens it, and selects its first branch. S and d act
    // on the stack of the fold, through its first branch.
    if (fold) {
      if (k === 'return' || k === 'z') {
        return openFold(fold.key, fold.rows[0].name)
      }
      if (k !== 'S' && k !== 'd') return
    }
    const sel = row ?? fold?.rows[0]
    if (!sel) return
    if (k === 'z' && sel.stack && open.has(stackKey(sel))) {
      return closeFold(stackKey(sel))
    }
    // These keys act on the branch itself. Ignore them for a branch that does
    // not exist locally: the footer does not show them.
    if (!sel.exists && (k === 'return' || k === 'p' || k === 'r')) return
    switch (k) {
      case 'return':
        return runAction(`checking out ${sel.name}…`, () =>
          actions.checkoutBranch(sel),
        )
      case 'n':
        return ask(
          'New branch',
          `Name of the branch from ${repo.defaultBranch}:`,
          (name) =>
            runAction(`creating ${name}…`, () => actions.newBranch(repo, name)),
        )
      case 's':
        if (sel.kind === 'trunk')
          return setStatus({
            text: 'press n to start a branch first',
            variant: 'error',
          })
        return ask(
          sel.stack ? 'Add to stack' : 'Make a stack',
          sel.stack
            ? `Name of the branch on top of ${sel.stack.top}:`
            : `Name of the branch after ${sel.name}:`,
          (name) =>
            runAction(`adding ${name}…`, () =>
              actions.stackBranch(repo, sel, name),
            ),
        )
      case 'p':
        return runAction(`pushing ${sel.name}…`, () =>
          actions.push(repo, sel, pr),
        )
      case 'S':
        return runAction('syncing…', () => actions.sync(repo, sel))
      case 'r':
        return runAction('rebasing…', () => actions.rebase(repo, sel))
      case 'o':
        return runAction('opening the PR…', () => actions.openPr(pr))
      case 'u':
        return confirmUndo()
      case 'd':
        if (sel.stack) {
          if (!stackFinished(sel, data, prs.data)) {
            return setStatus({
              text: 'the stack has open branches. Use gh stack unstack in a terminal',
              variant: 'error',
            })
          }
          return setMode({
            type: 'confirm',
            severity: 'warning',
            title: 'Remove stack',
            text: 'All the branches of this stack are merged. Remove the stack from this repository? It stays on GitHub.',
            choices: {
              y: {
                label: 'remove',
                run: () =>
                  runAction('removing the stack…', () =>
                    actions.removeStack(repo, sel),
                  ),
              },
            },
          })
        }
        if (sel.kind !== 'branch')
          return setStatus({
            text: 'the default branch cannot be deleted',
            variant: 'error',
          })
        return confirmDelete(sel)
    }
  }
  useKeyboard((key) => handleKey(keyName(key)))

  function openFold(key: string, select: string) {
    setOpen((o) => new Set(o).add(key))
    setSelected(select)
  }
  function closeFold(key: string) {
    setOpen((o) => {
      const next = new Set(o)
      next.delete(key)
      return next
    })
    setSelected(foldKey(key))
  }

  // A click selects an item. A click on a fold also opens it.
  const selectItem = (key: string) => {
    if (mode.type !== 'list') return
    const clicked = items.find((i) => i.key === key)
    if (clicked?.type === 'fold') {
      openFold(clicked.fold.key, clicked.fold.rows[0].name)
    } else {
      setSelected(key)
    }
  }

  if (!data) {
    return (
      <box padding={1}>
        <text fg={model.error ? color.red : color.dim}>
          {model.error ? model.error.message : `${spinner} loading branches…`}
        </text>
      </box>
    )
  }

  const narrow = width < NARROW
  // The rows of the panes: all but the header, the footer and the margin.
  const modalOpen = mode.type === 'confirm' || mode.type === 'input'
  const footerHints = hints(row, fold, open, data, agentEnabled, prs.data)
  const oneLineFooter =
    hintsWidth(footerHints) + MIN_STATUS_WIDTH + 2 * MARGIN + 4 <= width
  const footerHeight = oneLineFooter ? 1 : 2
  const bodyHeight = height - HEADER_HEIGHT - footerHeight - MARGIN
  const listHeight = (narrow ? Math.floor(bodyHeight / 2) : bodyHeight) - 2
  const repoName = basename(dirname(data.repo.commonDir))
  const statusColor = {
    info: color.dim,
    success: color.green,
    error: color.red,
  }[status.variant]

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* While a modal is open, dim the rest: it does not get the keys. */}
      <box flexDirection="column" flexGrow={1} opacity={modalOpen ? DIMMED : 1}>
        <Header
          repoName={repoName}
          model={data}
          spinner={spinner}
          prsUpdatedAt={prs.dataUpdatedAt}
          prsFetching={prs.isFetching}
          prsError={prs.error ? prs.error.message : null}
          themeLabel={themeLabel(theme)}
          onTheme={() => handleKey('t')}
        />

        {/* A margin on the left, the right and the bottom. Then the panes do
          not touch the edge of the window, also when the terminal adds its
          own strip there (for example Warp, when the window size is not a
          whole number of cells). */}
        <box
          flexDirection="column"
          flexGrow={1}
          paddingLeft={MARGIN}
          paddingRight={MARGIN}
          paddingBottom={MARGIN}
        >
          <box flexDirection={narrow ? 'column' : 'row'} flexGrow={1}>
            <box
              border
              borderColor={color.faint}
              title=" branches "
              height={narrow ? listHeight + 2 : undefined}
              width={narrow ? undefined : '55%'}
              flexShrink={0}
            >
              <BranchList
                sections={data.sections}
                open={open}
                selected={item?.key}
                onSelect={selectItem}
                onActivate={(key) => {
                  if (mode.type !== 'list') return
                  setSelected(key)
                  // A double-click checks out, but only a local branch.
                  if (data.rows.find((r) => r.name === key)?.exists) {
                    handleKey('return')
                  }
                }}
                onScroll={(down) => handleKey(down ? 'down' : 'up')}
                prs={prs.data}
                height={listHeight}
                changedFiles={data.repo.changedFiles}
              />
            </box>
            <box
              border
              borderColor={color.faint}
              title={
                mode.type === 'help'
                  ? ' keys '
                  : mode.type === 'theme'
                    ? ' themes '
                    : ' details '
              }
              flexGrow={1}
              flexDirection="column"
              overflow="hidden"
            >
              {mode.type === 'help' ? (
                <Help />
              ) : mode.type === 'theme' ? (
                <ThemePicker
                  active={theme}
                  saved={mode.saved}
                  onHighlight={showTheme}
                  onPick={pickTheme}
                  onKey={handleKey}
                />
              ) : (
                <>
                  {agent ? (
                    <AgentPanel
                      agent={agent}
                      spinner={spinner}
                      onPress={handleKey}
                    />
                  ) : (
                    <RebaseBanner
                      repo={data.repo}
                      agentEnabled={agentEnabled}
                      onPress={handleKey}
                    />
                  )}
                  {fold ? (
                    <FoldDetails
                      fold={fold}
                      rows={data.rows}
                      prs={prs.data}
                      onOpenUrl={(url) =>
                        runAction('opening…', () => actions.openUrl(url))
                      }
                    />
                  ) : (
                    <Details
                      row={row}
                      rows={data.rows}
                      prs={prs.data}
                      repo={data.repo}
                      onOpenPr={() => handleKey('o')}
                      onOpenUrl={(url) =>
                        runAction('opening…', () => actions.openUrl(url))
                      }
                      pr={row ? prs.data?.[row.name] : undefined}
                      prsLoading={prs.isLoading}
                    />
                  )}
                </>
              )}
            </box>
          </box>

          <box
            flexDirection={oneLineFooter ? 'row' : 'column'}
            height={footerHeight}
            paddingLeft={1}
            paddingRight={1}
            gap={oneLineFooter ? 4 : 0}
          >
            {oneLineFooter ? (
              <>
                <box flexShrink={0}>
                  <HintBar items={footerHints} onPress={handleKey} />
                </box>
                <text
                  flexGrow={1}
                  flexShrink={1}
                  fg={statusColor}
                  textAlign="right"
                  wrapMode="none"
                  truncate
                >
                  {status.text}
                </text>
              </>
            ) : (
              <>
                <text fg={statusColor} wrapMode="none" truncate>
                  {status.text}
                </text>
                <HintBar items={footerHints} onPress={handleKey} />
              </>
            )}
          </box>
        </box>
      </box>
      {mode.type === 'confirm' && (
        <Modal
          severity={mode.severity}
          title={mode.title}
          width={width}
          height={height}
          hints={[
            ...Object.entries(mode.choices).map(([key, c]) => ({
              key,
              label: c.label,
            })),
            { key: 'escape', label: 'cancel' },
          ]}
          onPress={handleKey}
        >
          <text fg={color.text} wrapMode="word">
            {mode.text}
          </text>
        </Modal>
      )}
      {mode.type === 'input' && (
        <Modal
          severity="info"
          title={mode.title}
          width={width}
          height={height}
          hints={[
            { key: 'return', label: 'create', clickable: false },
            { key: 'escape', label: 'cancel' },
          ]}
          onPress={handleKey}
        >
          <text fg={color.dim}>{mode.label}</text>
          <box
            border
            borderStyle="rounded"
            borderColor={color.faint}
            height={3}
            marginTop={1}
          >
            <input
              focused
              textColor={color.text}
              onInput={(value: string) => {
                inputValue.current = value
              }}
              onSubmit={() => {
                const value = inputValue.current.trim()
                setMode({ type: 'list' })
                if (value) mode.onSubmit(value)
              }}
            />
          </box>
        </Modal>
      )}
    </box>
  )
}
