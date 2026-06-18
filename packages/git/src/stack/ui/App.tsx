import { useCallback, useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { execa } from 'execa'
import { buildForest, flatten, type FlatNode } from '#src/stack/graph'
import { restack } from '#src/stack/restack'
import { sync } from '#src/stack/sync'
import { branchDiff } from '#src/stack/diff'
import { branchLog, type BranchLog } from '#src/stack/log'
import { branchPr, type PrInfo } from '#src/stack/pr'
import { Tree } from './Tree'
import { DiffPane } from './DiffPane'
import { LogPane } from './LogPane'
import { InfoPane } from './InfoPane'
import { Tabs, TABS, type TabMode } from './Tabs'
import { useTerminalSize } from './useTerminalSize'

type DiffState = { text: string; truncated: boolean } | null
type LogState = BranchLog | null

// Full-screen stack navigator laid out as header / two-column body / footer.
// The left column is the branch tree; the right column shows branch info, a diff
// or a commit log for the selected branch. Owns the cursor and all mutations;
// every git operation reloads the forest so the tree, badges and ahead/behind
// counts stay in sync with reality.
export function App() {
  const { exit } = useApp()
  const { cols, rows } = useTerminalSize()

  const [nodes, setNodes] = useState<FlatNode[]>([])
  const [trunk, setTrunk] = useState('main')
  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState('loading…')
  const [busy, setBusy] = useState(false)
  const [right, setRight] = useState<TabMode>('info')
  const [diff, setDiff] = useState<DiffState>(null)
  const [log, setLog] = useState<LogState>(null)
  // Per-branch PR cache for the session (network lookups via `gh`).
  const [prs, setPrs] = useState<Record<string, PrInfo | null>>({})

  const reload = useCallback(async (focusCurrent = false) => {
    const { root, meta } = await buildForest()
    const flat = flatten(root)
    setTrunk(meta.trunk)
    setNodes(flat)
    setSelected((s) => {
      // On the initial load, land the cursor on the checked-out branch; on
      // reloads after an operation, keep wherever the user navigated to.
      if (focusCurrent) {
        const current = flat.findIndex((n) => n.node.isCurrent)
        if (current >= 0) return current
      }
      return Math.max(0, Math.min(s, flat.length - 1))
    })
  }, [])

  useEffect(() => {
    reload(true)
      .then(() => setStatus('ready'))
      .catch((e) => setStatus(String(e)))
  }, [reload])

  const selectedNode = nodes[selected]?.node

  // Load the selected branch's diff lazily, only while the diff pane is open.
  useEffect(() => {
    if (right !== 'diff' || !selectedNode || selectedNode.isTrunk) {
      setDiff(null)
      return
    }
    let cancelled = false
    const name = selectedNode.name
    branchDiff(name).then((d) => {
      if (!cancelled) setDiff({ text: d.text, truncated: d.truncated })
    })
    return () => {
      cancelled = true
    }
  }, [right, selectedNode])

  // Load the selected branch's commit log lazily, only while the log pane is
  // open. Trunk is allowed — branchLog shows its recent history.
  useEffect(() => {
    if (right !== 'log' || !selectedNode) {
      setLog(null)
      return
    }
    let cancelled = false
    const name = selectedNode.name
    branchLog(name).then((result) => {
      if (!cancelled) setLog(result)
    })
    return () => {
      cancelled = true
    }
  }, [right, selectedNode])

  // Look up the selected branch's PR while the info pane is showing, caching the
  // result so navigating back doesn't re-hit `gh`.
  useEffect(() => {
    if (right !== 'info' || !selectedNode || selectedNode.isTrunk) return
    const name = selectedNode.name
    if (name in prs) return
    let cancelled = false
    branchPr(name).then((info) => {
      if (!cancelled) setPrs((m) => ({ ...m, [name]: info }))
    })
    return () => {
      cancelled = true
    }
  }, [right, selectedNode, prs])

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setBusy(true)
      setStatus(label)
      try {
        setStatus(await fn())
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error))
      }
      await reload()
      setBusy(false)
    },
    [reload],
  )

  const checkout = (name: string) =>
    run(`checking out ${name}…`, async () => {
      await execa('git', ['checkout', name])
      return `on ${name}`
    })

  // Open the branch's PR in the browser. `gh pr view --web` exits non-zero when
  // there's no PR (or gh isn't set up), which we surface as a friendly message.
  const openPr = (name: string) =>
    run(`opening PR for ${name}…`, async () => {
      try {
        await execa('gh', ['pr', 'view', name, '--web'])
        return `opened PR for ${name}`
      } catch {
        return `no PR found for ${name}`
      }
    })

  const doRestack = () =>
    run('restacking…', async () => {
      const r = await restack()
      if (r.conflict) {
        return `conflict on ${r.conflict.branch} — resolve, run \`git rebase --continue\`, then restack again`
      }
      return r.restacked.length
        ? `restacked ${r.restacked.join(', ')}`
        : 'already up to date'
    })

  const doSync = () =>
    run('syncing…', async () => {
      const r = await sync()
      if (r.merged.length) {
        // The merged branches' changes are in trunk; drop the local refs. Step
        // off them first so git doesn't refuse to delete the current branch.
        await execa('git', ['checkout', trunk]).catch(() => {})
        for (const b of r.merged) {
          await execa('git', ['branch', '-D', b]).catch(() => {})
        }
      }
      if (r.restack.conflict) {
        return `synced, but conflict on ${r.restack.conflict.branch} — resolve then restack`
      }
      return r.merged.length
        ? `synced — removed ${r.merged.join(', ')}`
        : 'nothing merged to sync'
    })

  useInput((input, key) => {
    if (key.ctrl && input === 'c') return exit()
    if (busy) return

    if (input === 'q' || key.escape) return exit()
    if (key.upArrow || input === 'k') {
      setSelected((s) => Math.max(0, s - 1))
    } else if (key.downArrow || input === 'j') {
      setSelected((s) => Math.min(nodes.length - 1, s + 1))
    } else if (key.return || input === 'c') {
      if (selectedNode) checkout(selectedNode.name)
    } else if (key.tab) {
      // Tab / Shift+Tab cycle through the right-panel tabs.
      const idx = TABS.findIndex((t) => t.mode === right)
      const delta = key.shift ? -1 : 1
      setRight(TABS[(idx + delta + TABS.length) % TABS.length].mode)
    } else if (TABS.some((t) => t.key === input)) {
      // Direct shortcuts (i/d/l) jump straight to a tab.
      setRight(TABS.find((t) => t.key === input)!.mode)
    } else if (input === 'o') {
      if (selectedNode && !selectedNode.isTrunk) openPr(selectedNode.name)
    } else if (input === 'r') {
      doRestack()
    } else if (input === 's') {
      doSync()
    } else if (input === 'R') {
      // Re-read everything and drop the PR cache so changes made elsewhere
      // (another tab's `stack create`, an external checkout, new commits, or a
      // freshly-opened PR) are all picked up.
      setPrs({})
      run('refreshing…', async () => 'refreshed')
    }
  })

  // Header (3) + footer (4) borders/lines leave the rest for the body. The right
  // panel additionally spends a row on its tab strip.
  const bodyHeight = Math.max(6, rows - 7)
  const leftWidth = Math.max(26, Math.floor(cols * 0.4))
  const treeRows = Math.max(3, bodyHeight - 3)
  const paneLines = Math.max(3, bodyHeight - 4)

  const prState =
    !selectedNode || selectedNode.isTrunk
      ? undefined
      : selectedNode.name in prs
        ? prs[selectedNode.name]
        : 'loading'

  let tabContent
  if (right === 'diff') {
    tabContent = selectedNode?.isTrunk ? (
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
    tabContent = log ? (
      <LogPane log={log} maxLines={paneLines} />
    ) : (
      <Text dimColor>loading…</Text>
    )
  } else {
    tabContent = <InfoPane node={selectedNode} pr={prState} />
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        justifyContent="space-between"
      >
        <Text bold color="cyan">
          dev stack
        </Text>
        <Text dimColor>
          trunk: {trunk} · {nodes.length} branches
        </Text>
      </Box>

      <Box flexGrow={1} flexDirection="row">
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          width={leftWidth}
        >
          <Text bold>Stack</Text>
          <Tree nodes={nodes} selected={selected} maxRows={treeRows} />
        </Box>

        <Box
          flexGrow={1}
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          marginLeft={1}
        >
          <Tabs
            active={right}
            branch={
              selectedNode && !selectedNode.isTrunk
                ? selectedNode.name
                : undefined
            }
          />
          <Box marginTop={1} flexDirection="column" flexGrow={1}>
            {tabContent}
          </Box>
        </Box>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
      >
        <Box>
          <Text color={busy ? 'yellow' : 'green'}>{busy ? '⏳ ' : '› '}</Text>
          <Text>{status}</Text>
        </Box>
        <Text dimColor>
          ↑/↓ move · enter checkout · tab/i/d/l tabs · o open-pr · r restack · s
          sync · R refresh · q quit
        </Text>
      </Box>
    </Box>
  )
}
