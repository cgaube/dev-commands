import { useRef, useState, type ReactNode } from 'react'
import { Box, Text, useBoxMetrics, useInput, type DOMElement } from 'ink'
import { Kbd } from '../Kbd'
import {
  AheadBadge,
  NeedsRebaseBadge,
  MergedBadge,
  PushBadge,
  AgeBadge,
  DirtyBadge,
  GoneBadge,
  ChecksBadge,
  PrStatusBadge,
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
      ['i', 'info pane', 'show branch details (short terminal only)'],
      ['l', 'log pane', 'show commit history (short terminal only)'],
    ],
  },
  {
    title: 'On a trunk row (all stacks of the trunk)',
    shortcuts: [
      ['n', 'new branch', 'git switch -c (another trunk: new stack)'],
      ['r', 'rebase all', 'gh stack rebase on each stack, no push'],
      ['S', 'sync all', 'fast-forward the trunk, then sync its stacks'],
    ],
  },
  {
    title: 'On a stack branch (its stack)',
    shortcuts: [
      ['n', 'add branch', 'gh stack add <name> after the last branch'],
      ['P', 'submit', 'gh stack submit --auto (new PRs are drafts)'],
      ['p', 'submit to here', 'push, then gh stack link up to this branch'],
      ['r', 'rebase', 'gh stack rebase, no push; continues a conflict'],
      ['S', 'sync', 'gh stack sync --prune, after a merge on GitHub'],
      ['o', 'open PR', 'open PR in browser'],
    ],
  },
  {
    title: 'On a normal branch (parent is the default branch)',
    shortcuts: [
      ['p/P', 'push + PR', 'push, then gh pr create --draft --fill'],
      ['r', 'rebase', 'git rebase <default>, no push; aborts on conflict'],
      ['o', 'open PR', 'open PR in browser'],
      ['n', 'make stack', 'gh stack init <branch> <name>: adopt it'],
      ['d', 'delete', 'git branch -d, optionally origin too'],
    ],
  },
  {
    title: 'Anywhere',
    shortcuts: [
      ['N', 'new branch', 'git switch -c <name> from default branch'],
    ],
  },
  {
    title: 'General',
    shortcuts: [
      ['R', 'refresh', 'reload branches and PR statuses'],
      ['?', 'this help', 'toggle help overlay'],
      ['q/esc', 'quit', 'exit the TUI'],
    ],
  },
]

type Badge = { node: ReactNode; desc: string }

const BRANCH_BADGES: Badge[] = [
  { node: <Text color="green">●</Text>, desc: 'checked-out branch' },
  { node: <Text>⌂</Text>, desc: 'trunk branch' },
  { node: <Text>○</Text>, desc: 'branch, not checked out' },
  { node: <Text color="blue">≡</Text>, desc: 'first branch of a stack' },
  { node: <AheadBadge count={3} />, desc: 'commits ahead of parent' },
  { node: <NeedsRebaseBadge />, desc: 'parent has moved, r or S' },
  { node: <MergedBadge />, desc: 'PR is merged' },
  {
    node: <PushBadge unpushed={2} unpulled={0} hasRemote />,
    desc: 'commits to push',
  },
  {
    node: <PushBadge unpushed={0} unpulled={1} hasRemote />,
    desc: 'commits to pull',
  },
  {
    node: <PushBadge unpushed={0} unpulled={0} hasRemote={false} />,
    desc: 'not pushed to origin',
  },
  {
    node: <AgeBadge committedAt={Date.now() / 1000 - 3 * 24 * 3600} />,
    desc: 'time since the last commit',
  },
  { node: <DirtyBadge count={3} />, desc: 'files not committed' },
  { node: <GoneBadge />, desc: 'branch ref no longer exists' },
]

const PR_BADGES: Badge[] = [
  { node: <ChecksBadge status="success" />, desc: 'CI checks passed' },
  { node: <ChecksBadge status="failure" />, desc: 'a CI check failed' },
  { node: <ChecksBadge status="pending" />, desc: 'CI checks running' },
  { node: <PrStatusBadge status="review" />, desc: 'PR waits for review' },
  {
    node: <PrStatusBadge status="approved" />,
    desc: 'PR approved, not mergeable yet',
  },
  { node: <PrStatusBadge status="ready" />, desc: 'PR ready to merge' },
  { node: <PrStatusBadge status="rework" />, desc: 'changes requested' },
  { node: <PrStatusBadge status="behind" />, desc: 'base moved, update PR' },
  {
    node: <PrStatusBadge status="conflicts" />,
    desc: 'PR has merge conflicts',
  },
  { node: <PrStatusBadge status="draft" />, desc: 'PR is a draft' },
  { node: <PrStatusBadge status="closed" />, desc: 'PR closed, not merged' },
]

// The width of the key and action columns of a shortcut row. The longest key
// is "q/esc" and the longest action is "submit to here".
const KEY_WIDTH = 7
const ACTION_WIDTH = 14
// The width of the badge column of a badge row. The widest badge is the PR
// status "conflicts": two spaces, the icon, a space and the word.
const BADGE_WIDTH = 13
const COLUMN_GAP = 3

type Section = { title: string; rows: ReactNode[] }

function ShortcutRow([key, action, desc]: Shortcut) {
  return (
    <Box key={`${key} ${action}`} gap={1}>
      <Box width={KEY_WIDTH} flexShrink={0} justifyContent="flex-end">
        <Kbd>{key}</Kbd>
      </Box>
      <Box width={ACTION_WIDTH} flexShrink={0}>
        <Text>{action}</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {desc}
      </Text>
    </Box>
  )
}

function BadgeRow({ node, desc }: Badge) {
  return (
    <Box key={desc} gap={1}>
      <Box width={BADGE_WIDTH} flexShrink={0} justifyContent="flex-end">
        {node}
      </Box>
      <Text dimColor wrap="truncate-end">
        {desc}
      </Text>
    </Box>
  )
}

const SHORTCUT_SECTIONS: Section[] = GROUPS.map((g) => ({
  title: g.title,
  rows: g.shortcuts.map(ShortcutRow),
}))

const BADGE_SECTIONS: Section[] = [
  { title: 'Branch badges', rows: BRANCH_BADGES.map(BadgeRow) },
  { title: 'PR badges', rows: PR_BADGES.map(BadgeRow) },
]

// The width of each column, from its longest row, so that no description
// wraps. The descriptions are ASCII, so their length is their width.
const longest = (texts: string[]) => Math.max(...texts.map((t) => t.length))
const SHORTCUT_COLUMN_WIDTH =
  KEY_WIDTH +
  ACTION_WIDTH +
  2 +
  longest(GROUPS.flatMap((g) => g.shortcuts.map(([, , desc]) => desc)))
const BADGE_COLUMN_WIDTH =
  BADGE_WIDTH + 1 + longest([...BRANCH_BADGES, ...PR_BADGES].map((b) => b.desc))
const TWO_COLUMNS_WIDTH =
  SHORTCUT_COLUMN_WIDTH + COLUMN_GAP + BADGE_COLUMN_WIDTH
const BADGES_SIDE_BY_SIDE_WIDTH = 2 * BADGE_COLUMN_WIDTH + COLUMN_GAP

function SectionBox({ section }: { section: Section }) {
  return (
    <Box flexDirection="column">
      <Text bold dimColor>
        {section.title}
      </Text>
      {section.rows}
    </Box>
  )
}

// The shortcuts and the badges show side by side when both fit. Else the
// badges go below the shortcuts, with the two badge sections side by side
// when they fit. A description that does not fit is truncated. When the
// content is taller than the viewport, ↑/↓ scroll it. The content box keeps
// its natural height (flexShrink 0), so the difference of the two heights is
// the scroll range.
export function HelpOverlay() {
  const viewportRef = useRef<DOMElement>(null)
  const viewport = useBoxMetrics(viewportRef)
  const [contentRef, contentHeight] = useMeasuredHeight()
  const [scroll, setScroll] = useState(0)

  const maxScroll = Math.max(0, contentHeight - viewport.clientHeight)
  const clamped = Math.min(scroll, maxScroll)
  const twoColumns = viewport.clientWidth >= TWO_COLUMNS_WIDTH
  const badgesSideBySide =
    !twoColumns && viewport.clientWidth >= BADGES_SIDE_BY_SIDE_WIDTH

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setScroll(Math.max(0, clamped - 1))
    } else if (key.downArrow || input === 'j') {
      setScroll(Math.min(maxScroll, clamped + 1))
    }
  })

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
          {clamped < maxScroll && '↓ '}? or esc to close
        </Text>
      </Box>

      <Box
        ref={viewportRef}
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        overflow="hidden"
        contentOffsetY={clamped}
      >
        <Box
          ref={contentRef}
          flexShrink={0}
          flexDirection={twoColumns ? 'row' : 'column'}
          gap={twoColumns ? COLUMN_GAP : 1}
        >
          <Box flexDirection="column" flexGrow={1} gap={1}>
            {SHORTCUT_SECTIONS.map((section) => (
              <SectionBox key={section.title} section={section} />
            ))}
          </Box>
          <Box
            flexDirection={badgesSideBySide ? 'row' : 'column'}
            flexGrow={1}
            gap={badgesSideBySide ? COLUMN_GAP : 1}
          >
            {BADGE_SECTIONS.map((section) => (
              <Box key={section.title} width={BADGE_COLUMN_WIDTH}>
                <SectionBox section={section} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
