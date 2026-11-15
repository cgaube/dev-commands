import { basename, dirname } from 'path'
import { useEffect, useRef, useState } from 'react'
import { useIsFetching, useMutation, useQuery } from '@tanstack/react-query'
import type { KeyEvent } from '@opentui/core'
import {
  useKeyboard,
  useRenderer,
  useSelectionHandler,
  useTerminalDimensions,
} from '@opentui/react'
import * as actions from '#src/actions'
import { autoResolve } from '#src/autoResolve'
import type { AgentRun } from '#src/claude'
import { saveTheme } from '#src/config'
import type { Model, Row } from '#src/data/model'
import { AgentPanel, type AgentState } from './AgentPanel'
import { BranchList } from './BranchList'
import { copyText } from './clipboard'
import { ContextMenu } from './ContextMenu'
import { Details, FoldDetails, RebaseBanner } from './Details'
import { Header, HEADER_HEIGHT } from './Header'
import { Help } from './Help'
import {
  filterSections,
  foldKey,
  isMerged,
  listItems,
  needsSync,
  stackKey,
  type Fold,
  type Item,
} from './listItems'
import { findMergedBranches, type MergedBranch } from '#src/data/cleanup'
import { loadModel } from '#src/data/model'
import { Activity, spinnerAt, useFrame } from './Activity'
import { HintBar, hintsWidth, type HintItem } from './Kbd'
import { Modal, type Severity } from './Modal'
import { DraftModal, draftLayout } from './DraftModal'
import { editText } from './editor'
import type { AIProvider } from '#common/ai'
import { generateCommitMessage } from '#src/commitMessage'
import { generatePrText, splitText, type PrText } from '#src/prDescription'
import { keys, modelQuery, prsQuery, queryClient, type PrMap } from './query'
import { applyTheme, color, THEME_IDS, themeLabel, type ThemeId } from './theme'
import { ThemePicker } from './ThemePicker'
import { useGitWatch } from './useGitWatch'

type Mode =
  | { type: 'list' }
  | { type: 'help' }
  // The menu of a right click on a row, at the cell of the click.
  | { type: 'menu'; x: number; y: number; items: HintItem[]; index: number }
  // The filter of the branch list: the keys go to its input.
  | { type: 'filter'; initial: string }
  // A new PR or a commit message: the AI writes it (or the user, in the
  // editor), then the user reads it before it is used. While `text` and
  // `error` are both missing, the AI is writing. `readyAt` is the time when
  // the text came.
  | {
      type: 'draft'
      target: DraftTarget
      text?: PrText
      error?: string
      offset: number
      readyAt: number
    }
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
      // The keys that answer. Any other key cancels. Only an info question
      // takes `return`: enter must not confirm a risky change by mistake.
      choices: Record<string, { label: string; run: () => void }>
    }

// `working`: an action or a reload runs. The status line animates it.
type Status = {
  text: string
  variant: 'working' | 'info' | 'success' | 'error'
}

type Action = { label: string; fn: () => Promise<string> }

// What a draft is for: a PR of a branch, or a commit on the current branch.
type DraftTarget = { kind: 'pr'; row: Row } | { kind: 'commit' }
type DraftMode = Extract<Mode, { type: 'draft' }>

// The footer shows the key hints and the status on one line when they fit.
// Else it uses two lines: the status, then the hints. Prompts always use
// two lines.
const MIN_STATUS_WIDTH = 30
// The opacity of the panes behind a modal.
const DIMMED = 0.35
// The empty cells around the panes and the footer.
const MARGIN = 1

// A confirm modal ignores its keys for this long after it opens: a key
// press so soon cancels it. Then fast typing meant for another terminal (for
// example "py": p opens the push modal, y confirms it) does nothing.
const ARM_DELAY = 400

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
      h('S', 'update + clean up'),
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
  // Changes on the current branch: C commits them.
  const commit =
    row.isCurrent && model.repo.changedFiles ? [h('C', 'commit')] : []
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
      ...commit,
      h('s', 'add on top'),
      ...(local ? [h('p', 'push'), h('P', 'submit PRs')] : []),
      h('S', 'sync'),
      ...(local ? [h('r', 'rebase')] : []),
      ...common,
    ]
  }
  const pr = prs?.[row.name]
  const openPr = pr && pr.status !== 'merged' && pr.status !== 'closed'
  return [
    ...commit,
    h('p', 'push'),
    ...(openPr ? [] : [h('P', 'create PR')]),
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
  prAgent,
  statusSeconds,
}: {
  onQuit: () => void
  initialTheme: ThemeId
  // True when Claude can fix the conflicts. See src/claude.ts.
  agentEnabled: boolean
  // The AI CLI that writes new PRs, or null. See src/prDescription.ts.
  prAgent: AIProvider | null
  // How long a status message stays, in seconds. 0 keeps it until the next
  // one. A running action always shows.
  statusSeconds: number
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
    variant: 'working',
  })
  // Hide a message after a moment, as a toast does. A newer message
  // replaces the status object, so the timer of an older one does nothing.
  useEffect(() => {
    if (status.variant === 'working' || !status.text || statusSeconds <= 0)
      return
    const id = setTimeout(
      () =>
        setStatus((s) => (s === status ? { text: '', variant: 'info' } : s)),
      statusSeconds * 1000,
    )
    return () => clearTimeout(id)
  }, [status, statusSeconds])

  const data = model.data
  const prs = useQuery(prsQuery(data))
  // The stacks of which the fold of merged branches is open.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  // The text of the branch filter. See filterSections.
  const [filter, setFilter] = useState('')
  const sections = data ? filterSections(data.sections, filter) : []
  // The items that the keyboard moves through: branches and folds.
  const items = listItems(sections, prs.data, open)
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
      // While the filter changes, select the first match.
      setSelected(
        inFold?.key ??
          (filter
            ? items[0]?.key
            : items[Math.min(lastIndex.current, items.length - 1)]?.key),
      )
    }
  }, [data, prs.data, open, filter])
  lastIndex.current = index

  useEffect(() => {
    if (model.error)
      setStatus({ text: String(model.error.message), variant: 'error' })
  }, [model.error])

  // Reload the git data after each action. Reload the PRs in the background:
  // GitHub is slow, and the keys must not wait for it.
  const action = useMutation({
    mutationFn: (a: Action) => a.fn(),
    onMutate: (a) => setStatus({ text: a.label, variant: 'working' }),
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

  const prWriting = mode.type === 'draft' && !mode.text && !mode.error
  const frame = useFrame(
    busy || fetching || prWriting || status.variant === 'working',
  )
  const spinner = busy || fetching || prWriting ? spinnerAt(frame) : ' '

  // Ask the AI for a PR or a commit message, and show it in the draft
  // modal. A newer request, or a cancel, makes the answer of an older one
  // useless: `draftRequest` counts them.
  const draftRequest = useRef(0)
  const writeDraft = (target: DraftTarget) => {
    if (!data || !prAgent) return
    const request = ++draftRequest.current
    setMode({ type: 'draft', target, offset: 0, readyAt: 0 })
    const answer = (result: { text?: PrText; error?: string }) => {
      if (request !== draftRequest.current) return
      setMode((m) =>
        m.type === 'draft' ? { ...m, ...result, readyAt: Date.now() } : m,
      )
    }
    const job =
      target.kind === 'pr'
        ? generatePrText(prAgent, data.repo, target.row)
        : generateCommitMessage(prAgent, data.repo)
    job.then(
      (text) => answer({ text }),
      (error) =>
        answer({
          error: `${prAgent.name} failed: ${error.message || String(error)}`,
        }),
    )
  }

  // Open the text of the draft in $EDITOR. The text after the edit replaces
  // it. An empty text changes nothing.
  const editDraft = async (draft: DraftMode) => {
    const name =
      draft.target.kind === 'pr' ? 'PR_DESCRIPTION.md' : 'COMMIT_EDITMSG'
    const before = draft.text
      ? draft.text.body
        ? `${draft.text.title}\n\n${draft.text.body}\n`
        : `${draft.text.title}\n`
      : ''
    try {
      const edited = await editText(renderer, before, name)
      if (!edited.trim()) {
        setMode(draft)
        return setStatus({
          text: 'the text is empty: nothing changed',
          variant: 'error',
        })
      }
      draftRequest.current++
      setMode({
        ...draft,
        text: splitText(edited),
        error: undefined,
        offset: 0,
        readyAt: Date.now(),
      })
    } catch (error) {
      setMode(draft)
      setStatus({
        text: error instanceof Error ? error.message : String(error),
        variant: 'error',
      })
    }
  }

  // C: commit the changes on the current branch. The AI writes the
  // message; without AI, the user writes it in the editor.
  const startCommit = () => {
    if (!data) return
    const repo = data.repo
    if (!repo.changedFiles)
      return setStatus({ text: 'nothing to commit', variant: 'error' })
    if (!repo.currentBranch)
      return setStatus({ text: 'check out a branch first', variant: 'error' })
    if (repo.currentBranch === repo.defaultBranch)
      return setStatus({
        text: `you are on ${repo.defaultBranch}: press n to start a branch with these changes`,
        variant: 'error',
      })
    const target: DraftTarget = { kind: 'commit' }
    if (prAgent) return writeDraft(target)
    void editDraft({
      type: 'draft',
      target,
      offset: 0,
      readyAt: 0,
      error: 'write the commit message in the editor (press e)',
    })
  }

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
  // Ask before an action. All the key actions go through a modal, so that a
  // key press meant for another window does not change the repository.
  // Enter confirms: these actions do not lose work. The yellow and red
  // questions use y.
  const confirm = (
    title: string,
    text: string,
    label: string,
    run: () => void,
  ) =>
    setMode({
      type: 'confirm',
      severity: 'info',
      title,
      text,
      choices: { return: { label, run } },
    })

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

  // Select the item, and open the menu of its actions. The menu shows the
  // actions of the footer, without the keys that do not act on the item.
  const openMenu = (key: string, x: number, y: number) => {
    if (mode.type !== 'list' && mode.type !== 'menu') return
    const clicked = items.find((i) => i.key === key)
    if (!clicked || !data) return
    const menuItems = hints(
      clicked.type === 'row' ? clicked.row : undefined,
      clicked.type === 'fold' ? clicked.fold : undefined,
      open,
      data,
      agentEnabled,
      prs.data,
    ).filter((h) => !['?', 'q', 'R'].includes(h.key))
    if (!menuItems.length) return
    setSelected(key)
    setMode({ type: 'menu', x, y, items: menuItems, index: 0 })
  }

  // Close the menu, and act as the key of the item.
  const pickMenuItem = (key: string) => {
    setMode({ type: 'list' })
    listKey(key)
  }

  // p on a stack branch: push the whole stack, or with h, only the branches
  // from the bottom up to the selected one. The branches above stay local.
  const confirmPushStack = (sel: Row) => {
    if (!data || !sel.stack) return
    const repo = data.repo
    const active = (name: string) => {
      const r = data.rows.find((x) => x.name === name)
      return !!r?.exists && !isMerged(r, prs.data)
    }
    const pr = prs.data?.[sel.name]
    const at = sel.stack.branches.indexOf(sel.name)
    const upTo = sel.stack.branches.slice(0, at + 1).filter(active)
    const above = sel.stack.branches.slice(at + 1).filter(active)
    const whole = {
      label: 'whole stack',
      run: () =>
        runAction('pushing the stack…', () => actions.push(repo, sel, pr)),
    }
    if (!above.length) {
      return confirm(
        'Push stack',
        'Push all the branches of the stack to origin, with a lease for each branch (gh stack push). No PR is opened.',
        'push',
        whole.run,
      )
    }
    setMode({
      type: 'confirm',
      severity: 'info',
      title: 'Push stack',
      text: [
        'Push all the branches of the stack to origin, with a lease for each branch (gh stack push). No PR is opened.',
        '',
        `Press h to push only up to ${sel.name}: ${upTo.join(', ')}. ${above.length === 1 ? `${above[0]} stays` : `The ${above.length} branches above stay`} local.`,
      ].join('\n'),
      choices: {
        return: whole,
        h: {
          label: 'up to here',
          run: () =>
            runAction(`pushing up to ${sel.name}…`, () =>
              actions.pushStackUpTo(repo, upTo),
            ),
        },
      },
    })
  }

  // S on the trunk: update it, sync the stacks with merged branches, then
  // offer to delete the merged branches. The stacks go first: gh stack
  // deletes their merged branches itself, and a stack branch that git
  // deletes breaks the stack.
  const confirmUpdateTrunk = () => {
    if (!data) return
    const repo = data.repo
    const main = repo.defaultBranch
    const stacks = data.sections
      .filter((section) => needsSync(section, prs.data))
      .map((section) => section.rows.find((r) => r.exists) ?? section.rows[0])
    const syncText = stacks.length
      ? ` Then sync the ${stacks.length} stack${stacks.length > 1 ? 's' : ''} with merged branches (gh stack sync --prune, which pushes).`
      : ''
    confirm(
      `Update ${main}`,
      `Fetch origin (and prune the deleted remote branches), then fast-forward ${main}.${syncText} Then look for the merged and squash-merged branches: you choose before they are deleted.`,
      'update',
      () =>
        runAction(`updating ${main}…`, async () => {
          const messages = [await actions.updateTrunk(repo)]
          if (stacks.length)
            messages.push(await actions.syncStacks(repo, stacks))
          const fresh = await loadModel()
          const keep = new Set(
            fresh.rows.filter((r) => r.stack).map((r) => r.name),
          )
          keep.add(fresh.repo.currentBranch)
          const merged = await findMergedBranches(main, keep)
          if (merged.length) confirmDeleteMerged(merged)
          else messages.push('no merged branches')
          return messages.join(' · ')
        }),
    )
  }

  // List the merged branches, and delete them on y.
  const confirmDeleteMerged = (branches: MergedBranch[]) => {
    const SHOWN = 12
    const lines = branches
      .slice(0, SHOWN)
      .map(
        (b) => `• ${b.name}${b.how === 'squashed' ? ' (squash-merged)' : ''}`,
      )
    if (branches.length > SHOWN)
      lines.push(`• and ${branches.length - SHOWN} more`)
    setMode({
      type: 'confirm',
      severity: 'warning',
      title: `Delete ${branches.length} merged branch${branches.length > 1 ? 'es' : ''}`,
      text: [
        'Their work is in the default branch. Only the local branches go: stack branches and the current branch stay.',
        '',
        ...lines,
      ].join('\n'),
      choices: {
        y: {
          label: 'delete',
          run: () =>
            runAction('deleting the merged branches…', () =>
              actions.deleteMergedBranches(branches),
            ),
        },
      },
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
      const armed = Date.now() - confirmOpenedAt.current >= ARM_DELAY
      const choice = armed ? mode.choices[k] : undefined
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
    if (mode.type === 'filter') {
      switch (k) {
        case 'escape':
          setFilter('')
          return setMode({ type: 'list' })
        case 'return':
          return setMode({ type: 'list' })
        case 'up':
        case 'down':
          return listKey(k)
      }
      // The other keys go to the input.
      return
    }
    if (mode.type === 'draft') {
      if (k === 'escape') {
        draftRequest.current++
        return setMode({ type: 'list' })
      }
      // Wait for the answer. Then ignore the keys for a moment: a key press
      // meant for another window must not push or commit.
      if (prWriting || Date.now() - mode.readyAt < ARM_DELAY) return
      const { maxOffset } = draftLayout(mode.text?.body ?? '', width, height)
      const scroll = (delta: number) =>
        setMode({
          ...mode,
          offset: Math.max(0, Math.min(maxOffset, mode.offset + delta)),
        })
      const { target, text } = mode
      const submitPr = (draft: boolean) => {
        if (!data || target.kind !== 'pr') return
        setMode({ type: 'list' })
        runAction(`pushing ${target.row.name}…`, () =>
          actions.createPr(data.repo, target.row, {
            text: text ?? null,
            draft,
          }),
        )
      }
      switch (k) {
        case 'up':
        case 'k':
          return scroll(-1)
        case 'down':
        case 'j':
          return scroll(1)
        case 'e':
          return void editDraft(mode)
        case 'g':
          return writeDraft(target)
        case 'return':
          if (target.kind === 'pr') return submitPr(true)
          if (!text) return
          setMode({ type: 'list' })
          return runAction('committing…', () => actions.commit(text))
        case 'o':
          return submitPr(false)
      }
      return
    }
    if (mode.type === 'menu') {
      const n = mode.items.length
      switch (k) {
        case 'up':
        case 'k':
          return setMode({ ...mode, index: (mode.index - 1 + n) % n })
        case 'down':
        case 'j':
          return setMode({ ...mode, index: (mode.index + 1) % n })
        case 'return':
          return pickMenuItem(mode.items[mode.index].key)
      }
      // The key of an item runs it. All other keys close the menu.
      if (mode.items.some((i) => i.key === k)) return pickMenuItem(k)
      return setMode({ type: 'list' })
    }
    listKey(k)
  }

  // Handle a key of the list: the moves and the actions.
  const listKey = (k: string) => {
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
      case '/':
        return setMode({ type: 'filter', initial: filter })
      case 'escape':
        if (filter) return setFilter('')
        return listKey('q')
      case 'q':
        return confirm(
          'Quit',
          busy
            ? 'Close git-tui. An action is running: it can stop before it is done.'
            : 'Close git-tui. Press ctrl+c to quit without this question.',
          'quit',
          () => {
            agentRun.current?.cancel()
            onQuit()
          },
        )
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
        setStatus({
          text: 'reloading the branches and the PRs',
          variant: 'working',
        })
        queryClient.invalidateQueries().then(
          () => setStatus({ text: 'up to date', variant: 'success' }),
          (error) => setStatus({ text: error.message, variant: 'error' }),
        )
        return
    }
    if (!data || busy) return
    const repo = data.repo
    const pr = row ? prs.data?.[row.name] : undefined
    const confirmOpenPr = () => {
      if (!pr)
        return setStatus({ text: 'this branch has no PR', variant: 'error' })
      confirm('Open PR', `Open PR #${pr.number} in the browser.`, 'open', () =>
        runAction('opening the PR…', () => actions.openPr(pr)),
      )
    }

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
          return confirm(
            'Fix with Claude',
            `Claude edits ${repo.conflicts.join(', ')} to fix the conflicts, then continues the rebase. Press u after to undo it.`,
            'fix',
            startAutoResolve,
          )
        case 'u':
          return confirmUndo()
        case 'c':
          return confirm(
            'Continue rebase',
            'Continue the rebase with the files as they are now. Fix the conflicts and git add the files first.',
            'continue',
            () =>
              runAction('continuing the rebase…', () =>
                actions.continueRebase(repo.rebase),
              ),
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
          return confirmOpenPr()
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
    if (!sel.exists && ['return', 'p', 'P', 'r'].includes(k)) return
    switch (k) {
      case 'return':
        if (sel.isCurrent)
          return setStatus({
            text: `already on ${sel.name}`,
            variant: 'info',
          })
        return confirm(
          'Check out branch',
          `Check out ${sel.name}. The changes that are not committed come with you. Git stops when they conflict.`,
          'check out',
          () =>
            runAction(`checking out ${sel.name}…`, () =>
              actions.checkoutBranch(sel),
            ),
        )
      case 'C':
        return startCommit()
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
      case 'p': {
        if (!sel.stack && sel.kind !== 'branch')
          return setStatus({
            text: 'push the default branch in a terminal',
            variant: 'error',
          })
        if (!sel.stack && sel.ahead === 0)
          return setStatus({
            text: `${sel.name} has no commits to push`,
            variant: 'error',
          })
        if (sel.stack) return confirmPushStack(sel)
        const openPr = pr && pr.status !== 'merged' && pr.status !== 'closed'
        return confirm(
          sel.stack ? 'Push stack' : 'Push branch',
          sel.stack
            ? `Push all the branches of the stack to origin, with a lease for each branch (gh stack push). No PR is opened.`
            : `Force-push ${sel.name} to origin (with lease).${openPr ? ` PR #${pr.number} gets the new commits.` : ' No PR is opened: press P for that.'}`,
          'push',
          () =>
            runAction(`pushing ${sel.name}…`, () =>
              actions.push(repo, sel, pr),
            ),
        )
      }
      case 'P': {
        if (sel.stack)
          return confirm(
            'Submit stack',
            'Push all the branches of the stack to origin, and open the missing PRs as drafts (gh stack submit).',
            'submit',
            () =>
              runAction('submitting the stack…', () =>
                actions.submitStack(repo, sel),
              ),
          )
        if (sel.kind !== 'branch')
          return setStatus({
            text: 'the default branch has no PR',
            variant: 'error',
          })
        if (prs.isLoading)
          return setStatus({
            text: 'wait for the PRs to load',
            variant: 'error',
          })
        if (pr && pr.status !== 'merged' && pr.status !== 'closed')
          return setStatus({
            text: `PR #${pr.number} is open. Press o to see it`,
            variant: 'error',
          })
        // The AI writes the PR, and the user reads it before the push.
        if (prAgent) return writeDraft({ kind: 'pr', row: sel })
        return confirm(
          'Create PR',
          `Force-push ${sel.name} to origin (with lease), then open a draft PR against ${repo.defaultBranch} with the commit messages.`,
          'create PR',
          () =>
            runAction(`pushing ${sel.name}…`, () =>
              actions.createPr(repo, sel, { text: null, draft: true }),
            ),
        )
      }
      case 'S':
        if (sel.kind === 'trunk') return confirmUpdateTrunk()
        if (!sel.stack)
          return setStatus({
            text: 'sync works on stacks. Use r to rebase',
            variant: 'error',
          })
        return confirm(
          'Sync stack',
          `Fetch, rebase the stack onto ${sel.stack.trunk}, push, and delete the local branches of merged PRs. Press u after to undo the rebase.`,
          'sync',
          () => runAction('syncing…', () => actions.sync(repo, sel)),
        )
      case 'r':
        return confirm(
          sel.stack ? 'Rebase stack' : 'Rebase branch',
          sel.stack
            ? `Rebase all the branches of the stack onto ${sel.stack.trunk}, without a push. Press u after to undo.`
            : `Rebase ${sel.name} onto ${repo.defaultBranch}, without a push. Press u after to undo.`,
          'rebase',
          () => runAction('rebasing…', () => actions.rebase(repo, sel)),
        )
      case 'o':
        return confirmOpenPr()
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
  useKeyboard((key) => {
    // A key press ends the text selection. The text stays on the clipboard.
    if (renderer.hasSelection) renderer.clearSelection()
    handleKey(keyName(key))
  })

  // Drag over any text to copy it: a double-click copies a word, a triple
  // click a line. A plain click selects nothing, so it copies nothing.
  useSelectionHandler((selection) => {
    const { anchor, focus, behavior } = selection
    const click = anchor.x === focus.x && anchor.y === focus.y
    if (click && behavior === 'cell') return
    const text = selection.getSelectedText()
    if (!text.trim()) return
    copyText(renderer, text).then(
      () =>
        setStatus({
          text: `copied ${text.length} character${text.length > 1 ? 's' : ''}`,
          variant: 'success',
        }),
      (error) =>
        setStatus({ text: `not copied: ${error.message}`, variant: 'error' }),
    )
  })

  const confirmOpenedAt = useRef(0)
  useEffect(() => {
    if (mode.type === 'confirm') confirmOpenedAt.current = Date.now()
  }, [mode])

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
    if (mode.type !== 'list' && mode.type !== 'filter') return
    const clicked = items.find((i) => i.key === key)
    if (clicked?.type === 'fold') {
      openFold(clicked.fold.key, clicked.fold.rows[0].name)
    } else {
      setSelected(key)
    }
  }

  // The title, the texts and the keys of the draft modal.
  const draftView = (draft: DraftMode) => {
    const ai = prAgent?.name ?? 'AI'
    const ready = !!draft.text || !!draft.error
    const again = prAgent
      ? [{ key: 'g', label: draft.text ? 'write again' : 'try again' }]
      : []
    const cancel = { key: 'escape', label: 'cancel' }
    if (draft.target.kind === 'pr') {
      const { text } = draft
      return {
        title: 'Push and open a PR',
        subtitle: `${draft.target.row.name} → ${data?.repo.defaultBranch}`,
        writing: `${ai} is writing the title and the description`,
        hints: ready
          ? [
              {
                key: 'return',
                label: text ? 'draft PR' : 'draft PR from commits',
              },
              {
                key: 'o',
                label: text ? 'ready for review' : 'ready, from commits',
              },
              { key: 'e', label: 'edit' },
              ...again,
              cancel,
            ]
          : [cancel],
      }
    }
    const files = data?.repo.changedFiles ?? 0
    return {
      title: 'Commit',
      subtitle: `${data?.repo.currentBranch} · ${`all the changes: ${files} file${files === 1 ? '' : 's'}, new files too`}`,
      writing: `${ai} is writing the commit message`,
      hints: ready
        ? [
            ...(draft.text ? [{ key: 'return', label: 'commit' }] : []),
            { key: 'e', label: draft.text ? 'edit' : 'write it' },
            ...again,
            cancel,
          ]
        : [cancel],
    }
  }

  if (!data) {
    return (
      <box padding={1}>
        <text fg={model.error ? color.red : color.dim}>
          {model.error ? (
            model.error.message
          ) : (
            <Activity text="loading the branches" frame={frame} />
          )}
        </text>
      </box>
    )
  }

  const narrow = width < NARROW
  // The rows of the panes: all but the header, the footer and the margin.
  const modalOpen =
    mode.type === 'confirm' || mode.type === 'input' || mode.type === 'draft'
  const filtering = mode.type === 'filter'
  const footerHints: HintItem[] = filtering
    ? [
        { key: 'return', label: 'keep', clickable: false },
        { key: 'escape', label: 'clear' },
      ]
    : [
        ...hints(row, fold, open, data, agentEnabled, prs.data),
        ...(filter ? [{ key: 'escape', label: 'clear filter' }] : []),
      ]
  const oneLineFooter =
    hintsWidth(footerHints) + MIN_STATUS_WIDTH + 2 * MARGIN + 4 <= width
  const footerHeight = oneLineFooter || filtering ? 1 : 2
  const bodyHeight = height - HEADER_HEIGHT - footerHeight - MARGIN
  const listHeight = (narrow ? Math.floor(bodyHeight / 2) : bodyHeight) - 2
  const repoName = basename(dirname(data.repo.commonDir))
  const statusColor = {
    working: color.dim,
    info: color.dim,
    success: color.green,
    error: color.red,
  }[status.variant]

  const statusText =
    status.variant === 'working' ? (
      <Activity text={status.text} frame={frame} />
    ) : (
      status.text
    )

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* While a modal is open, dim the rest: it does not get the keys. */}
      <box flexDirection="column" flexGrow={1} opacity={modalOpen ? DIMMED : 1}>
        <Header
          repoName={repoName}
          model={data}
          frame={frame}
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
              title={filter ? ` branches · /${filter} ` : ' branches '}
              height={narrow ? listHeight + 2 : undefined}
              width={narrow ? undefined : '55%'}
              flexShrink={0}
            >
              {!sections.length && (
                <text fg={color.dim} paddingLeft={1}>
                  no branch matches "{filter}"
                </text>
              )}
              <BranchList
                sections={sections}
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
                onMenu={openMenu}
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
            flexDirection={oneLineFooter || filtering ? 'row' : 'column'}
            height={footerHeight}
            paddingLeft={1}
            paddingRight={1}
            gap={oneLineFooter || filtering ? 4 : 0}
          >
            {filtering ? (
              <>
                <box flexDirection="row" flexGrow={1} height={1}>
                  <text fg={color.accent} flexShrink={0}>
                    /{' '}
                  </text>
                  <input
                    focused
                    flexGrow={1}
                    value={mode.initial}
                    textColor={color.text}
                    placeholder="filter the branches"
                    onInput={(value: string) => setFilter(value)}
                  />
                </box>
                <HintBar items={footerHints} onPress={handleKey} />
              </>
            ) : oneLineFooter ? (
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
                  {statusText}
                </text>
              </>
            ) : (
              <>
                <text fg={statusColor} wrapMode="none" truncate>
                  {statusText}
                </text>
                <HintBar items={footerHints} onPress={handleKey} />
              </>
            )}
          </box>
        </box>
      </box>
      {mode.type === 'menu' && (
        <ContextMenu
          items={mode.items}
          index={mode.index}
          x={mode.x}
          y={mode.y}
          width={width}
          height={height}
          onHighlight={(index) => setMode({ ...mode, index })}
          onPick={pickMenuItem}
          onClose={() => setMode({ type: 'list' })}
        />
      )}
      {mode.type === 'draft' && (
        <DraftModal
          {...draftView(mode)}
          text={mode.text}
          error={mode.error}
          offset={mode.offset}
          frame={frame}
          width={width}
          height={height}
          onPress={handleKey}
        />
      )}
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
