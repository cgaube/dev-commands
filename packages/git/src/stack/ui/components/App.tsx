import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { execa } from 'execa'
import { buildForest, flatten, type FlatNode } from '#src/stack/graph'
import { gitOutput } from '#src/utils/git'
import { restack } from '#src/stack/restack'
import { sync } from '#src/stack/sync'
import { branchDiff } from '#src/stack/diff'
import { branchLog, type BranchLog } from '#src/stack/log'
import { branchPr, type PrInfo } from '#src/stack/pr'
import { track } from '#src/stack/model'
import { Tree } from './Tree'
import { CreateModal } from './CreateModal'
import { DiffPane } from './DiffPane'
import { LogPane } from './LogPane'
import { InfoPane } from './InfoPane'
import { Tabs, TABS, type TabMode } from './Tabs'
import { Legend } from './Legend'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { useMeasuredHeight } from '../hooks/useMeasuredHeight'
import { useGitWatch } from '../hooks/useGitWatch'
import Spinner from 'ink-spinner'

type DiffState = { text: string; truncated: boolean } | null
type LogState = BranchLog | null

export function App() {
  const { exit } = useApp()
  const { cols, rows } = useTerminalSize()

  const [nodes, setNodes] = useState<FlatNode[]>([])
  const [trunk, setTrunk] = useState('main')
  const [selected, setSelected] = useState(0)
  const [status, setStatus] = useState('loading…')
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [right, setRight] = useState<TabMode>('info')
  const [diff, setDiff] = useState<DiffState>(null)
  const [log, setLog] = useState<LogState>(null)
  const [prs, setPrs] = useState<Record<string, PrInfo | null>>({})
  const [gitDir, setGitDir] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newBranch, setNewBranch] = useState('')

  const busyRef = useRef(busy)
  busyRef.current = busy

  const prFetchedRef = useRef(new Set<string>())

  // Flexbox lays out the chrome (header, status, legend) and the two content
  // boxes; these hooks read back the height each content box was actually given
  // so the tree and panes know how many rows they may render.
  const [treeRef, treeRows] = useMeasuredHeight()
  const [paneRef, paneLines] = useMeasuredHeight()

  const reload = useCallback(async (focusCurrent = false) => {
    const { root, meta } = await buildForest()
    const flat = flatten(root)
    setTrunk(meta.trunk)
    setNodes(flat)
    setSelected((s) => {
      if (focusCurrent) {
        const current = flat.findIndex((n) => n.node.isCurrent)
        if (current >= 0) return current
      }
      return Math.max(0, Math.min(s, flat.length - 1))
    })
  }, [])

  useEffect(() => {
    gitOutput(['rev-parse', '--absolute-git-dir']).then((d) =>
      setGitDir(d.trim()),
    )
    reload(true)
      .then(() => setStatus('ready'))
      .catch((e) => setStatus(String(e)))
  }, [reload])

  const watchReload = useCallback(async () => {
    if (busyRef.current) return
    setSyncing(true)
    try {
      await reload()
    } catch {
      // Branch may have been deleted mid-reload — swallow and retry next tick.
    }
    setSyncing(false)
  }, [reload])

  useGitWatch(gitDir, watchReload)

  const selectedNode = nodes[selected]?.node
  const currentBranch = nodes.find(({ node }) => node.isCurrent)?.node.name
  const hasTrackedBranches = nodes.some(({ node }) => !node.isTrunk)

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

  useEffect(() => {
    if (right !== 'info' || !selectedNode || selectedNode.isTrunk) return
    const name = selectedNode.name
    if (name in prs) return
    let cancelled = false
    prFetchedRef.current.add(name)
    branchPr(name).then((info) => {
      if (!cancelled) setPrs((m) => ({ ...m, [name]: info }))
    })
    return () => {
      cancelled = true
    }
  }, [right, selectedNode, prs])

  useEffect(() => {
    for (const { node } of nodes) {
      if (node.isTrunk || prFetchedRef.current.has(node.name)) continue
      prFetchedRef.current.add(node.name)
      branchPr(node.name).then((info) => {
        setPrs((m) => ({ ...m, [node.name]: info }))
      })
    }
  }, [nodes])

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

  const openPr = (name: string) =>
    run(`opening PR for ${name}…`, async () => {
      try {
        await execa('gh', ['pr', 'view', name, '--web'])
        return `opened PR for ${name}`
      } catch {
        return `no PR found for ${name}`
      }
    })

  const push = (name: string) =>
    run(`pushing ${name}…`, async () => {
      await execa('git', ['push', '--force-with-lease', '-u', 'origin', name])
      return `pushed ${name}`
    })

  const createPr = (name: string, parent: string) =>
    run(`creating PR for ${name}…`, async () => {
      await execa('git', ['push', '--force-with-lease', '-u', 'origin', name])
      try {
        await execa('gh', [
          'pr',
          'create',
          '--base',
          parent,
          '--web',
          '--head',
          name,
        ])
        return `opened PR creation for ${name}`
      } catch (e: any) {
        const msg = e.stderr || e.message || String(e)
        if (msg.includes('already exists'))
          return `PR already exists — press o to open`
        throw e
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

  const doCreate = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !selectedNode) return
    const parent = selectedNode.name
    setCreating(false)
    setNewBranch('')
    run(`creating ${trimmed}…`, async () => {
      await execa('git', ['checkout', '-b', trimmed, parent])
      await track(trimmed, parent)
      return `created ${trimmed} on ${parent}`
    })
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
      if (selectedNode) checkout(selectedNode.name)
    } else if (key.tab) {
      const idx = TABS.findIndex((t) => t.mode === right)
      const delta = key.shift ? -1 : 1
      setRight(TABS[(idx + delta + TABS.length) % TABS.length].mode)
    } else if (TABS.some((t) => t.key === input)) {
      setRight(TABS.find((t) => t.key === input)!.mode)
    } else if (input === 'o') {
      if (selectedNode && !selectedNode.isTrunk) openPr(selectedNode.name)
    } else if (input === 'p') {
      if (selectedNode && !selectedNode.isTrunk) push(selectedNode.name)
    } else if (input === 'P') {
      if (selectedNode && !selectedNode.isTrunk && selectedNode.parent) {
        createPr(selectedNode.name, selectedNode.parent)
      }
    } else if (input === 'r') {
      doRestack()
    } else if (input === 's') {
      doSync()
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
    <Box
      gap={0}
      flexDirection="column"
      height={rows}
      width="100%"
      paddingX={1}
      paddingY={0}
    >
      {/* Header */}
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
          trunk: {trunk} · {nodes.length} branches · current: {currentBranch}
        </Text>
      </Box>

      {/* Tree — sizes to its content up to treeMaxHeight, then clips and scrolls */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        flexShrink={0}
        maxHeight={treeMaxHeight}
        overflow="hidden"
      >
        <Box justifyContent="space-between">
          <Text bold>Stack</Text>
          {syncing && (
            <Text color="blue">
              <Spinner type="arc" /> syncing
            </Text>
          )}
        </Box>
        <Box
          ref={treeRef}
          flexDirection="column"
          flexGrow={1}
          minHeight={0}
          overflow="hidden"
        >
          <Tree
            nodes={nodes}
            selected={selected}
            maxRows={treeRows}
            maxWidth={innerWidth}
            prs={prs}
          />
          {!hasTrackedBranches && (
            <Text dimColor>no tracked branches — press n to create one</Text>
          )}
        </Box>
      </Box>

      {/* Tab panel / create modal */}
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
            {tabContent}
          </Box>
        </Box>
      )}

      {/* Status bar */}
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        {busy ? (
          <Text color="yellow">
            <Spinner type="dots" />{' '}
          </Text>
        ) : (
          <Text color="green">› </Text>
        )}
        <Text>{status}</Text>
      </Box>

      <Legend />
    </Box>
  )
}
