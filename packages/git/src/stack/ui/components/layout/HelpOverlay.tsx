import type { ReactNode } from 'react'
import { Box, Text } from 'ink'
import { Kbd } from '../Kbd'
import {
  AheadBadge,
  ParentMovedBadge,
  DivergedBadge,
  DirtyBadge,
  GoneBadge,
  ChecksBadge,
  ReviewBadge,
} from '../badges'
import { useMeasuredHeight } from '../../hooks/useMeasuredHeight'

type Shortcut = [key: string, action: string, desc: string]

type Group = { title: string; shortcuts: Shortcut[] }

const GROUPS: Group[] = [
  {
    title: 'Navigation',
    shortcuts: [
      ['↑/k', 'move up', 'select previous branch'],
      ['↓/j', 'move down', 'select next branch'],
      ['↵/c', 'checkout', 'switch to selected branch'],
      ['tab', 'next pane', 'cycle right panel forward'],
      ['S-tab', 'prev pane', 'cycle right panel backward'],
      ['i', 'info pane', 'show branch details'],
      ['l', 'log pane', 'show commit history'],
    ],
  },
  {
    title: 'Branch',
    shortcuts: [
      ['n', 'new branch', 'create a child of selected branch'],
      ['m', 'rename', 'rename selected branch locally'],
      ['u', 'untrack', 'remove branch from the stack'],
    ],
  },
  {
    title: 'Pull Request',
    shortcuts: [
      ['p', 'push', 'force-push branch to origin'],
      ['P', 'create PR', 'push and open PR creation in browser'],
      ['o', 'open PR', 'open existing PR in browser'],
    ],
  },
  {
    title: 'Stack',
    shortcuts: [
      ['r', 'restack', 'clean orphans and rebase onto parents'],
      ['F', 'fetch', 'fast-forward branch from origin'],
      ['R', 'refresh', 'reload stack view and PR statuses'],
    ],
  },
  {
    title: 'General',
    shortcuts: [
      ['?', 'this help', 'toggle help overlay'],
      ['q/esc', 'quit', 'exit the TUI'],
    ],
  },
]

const BADGE_ENTRIES: { node: ReactNode; desc: string }[] = [
  { node: <Text color="green">●</Text>, desc: 'checked-out branch' },
  { node: <Text>⌂</Text>, desc: 'trunk branch' },
  { node: <AheadBadge count={3} />, desc: 'commits ahead of parent' },
  { node: <ParentMovedBadge />, desc: 'parent has moved, needs restack' },
  { node: <DivergedBadge />, desc: 'local and remote differ' },
  { node: <DirtyBadge />, desc: 'uncommitted changes' },
  { node: <GoneBadge />, desc: 'branch ref no longer exists' },
  { node: <ChecksBadge status="success" />, desc: 'CI checks passing' },
  { node: <ChecksBadge status="failure" />, desc: 'CI checks failing' },
  { node: <ChecksBadge status="pending" />, desc: 'CI checks running' },
  { node: <ReviewBadge decision="APPROVED" />, desc: 'PR approved' },
  {
    node: <ReviewBadge decision="CHANGES_REQUESTED" />,
    desc: 'changes requested',
  },
]

type Line =
  | { type: 'title'; text: string }
  | { type: 'shortcut'; key: string; action: string; desc: string }
  | { type: 'badge'; node: ReactNode; desc: string }
  | { type: 'blank' }

const ALL_LINES: Line[] = [
  ...GROUPS.flatMap((g, i) => {
    const lines: Line[] = []
    if (i > 0) lines.push({ type: 'blank' })
    lines.push({ type: 'title', text: g.title })
    for (const [key, action, desc] of g.shortcuts) {
      lines.push({ type: 'shortcut', key, action, desc })
    }
    return lines
  }),
  { type: 'blank' },
  { type: 'title', text: 'Badges' },
  ...BADGE_ENTRIES.map(
    ({ node, desc }): Line => ({ type: 'badge', node, desc }),
  ),
]

function renderLine(line: Line, i: number) {
  if (line.type === 'blank') return <Text key={i}> </Text>
  if (line.type === 'title')
    return (
      <Text key={i} bold dimColor>
        {line.text}
      </Text>
    )
  if (line.type === 'badge')
    return (
      <Box key={i} gap={1}>
        <Box minWidth={9} justifyContent="flex-end">
          {line.node}
        </Box>
        <Text dimColor>— {line.desc}</Text>
      </Box>
    )
  return (
    <Box key={i} gap={1}>
      <Box minWidth={9} justifyContent="flex-end">
        <Kbd>{line.key}</Kbd>
      </Box>
      <Text>
        {line.action} <Text dimColor>— {line.desc}</Text>
      </Text>
    </Box>
  )
}

export function HelpOverlay({ scroll }: { scroll: number }) {
  const [ref, height] = useMeasuredHeight()

  const maxScroll = height > 0 ? Math.max(0, ALL_LINES.length - height) : 0
  const clamped = Math.min(scroll, maxScroll)
  const visible =
    height > 0 ? ALL_LINES.slice(clamped, clamped + height) : ALL_LINES

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor="gray"
      paddingX={2}
      minHeight={0}
      overflow="hidden"
    >
      <Box justifyContent="space-between" flexShrink={0} marginBottom={1}>
        <Text bold color="cyan">
          Help
        </Text>
        <Text dimColor>
          {clamped > 0 && '↑ '}
          {maxScroll > 0 && clamped < maxScroll && '↓ '}? or esc to close
        </Text>
      </Box>

      <Box
        ref={ref}
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        overflow="hidden"
      >
        {visible.map(renderLine)}
      </Box>
    </Box>
  )
}

export const HELP_LINE_COUNT = ALL_LINES.length
