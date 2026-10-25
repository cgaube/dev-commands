// Shows the Nerd Font icons that can mark each PR status, so you can pick
// them in your own terminal and font. Run: bun scripts/icon-preview.tsx
//
// It starts with a mock of the branch list and the info pane, drawn with the
// real components and made-up stacks, branches and PRs.
//
// Every icon here is in Nerd Fonts 3.4.0, except git_branch_conflicts (3.5). Sets: oct = GitHub Octicons,
// cod = VS Code Codicons, md = Material Design.
import pc from 'picocolors'
import { Box, render, Text } from 'ink'
import type { Branch, LocalStack, StackState } from '../src/stack/model'
import type { PrInfo, PrStatus } from '../src/stack/pr'
import { toRows } from '../src/ui/rows'
import { StackList } from '../src/ui/components/StackList'
import { InfoPane } from '../src/ui/components/InfoPane'
import { PR_STATUS_STYLES } from '../src/ui/components/badges/PrStatusBadge'
import { CI_ICON } from '../src/ui/components/badges/ChecksBadge'

type Icon = [set: 'oct' | 'cod' | 'md', name: string, code: number]

const COLORS: Record<PrStatus, (s: string) => string> = {
  review: pc.yellow,
  approved: pc.cyan,
  ready: pc.green,
  rework: pc.red,
  behind: pc.blue,
  conflicts: pc.red,
  draft: pc.gray,
  closed: pc.gray,
  merged: pc.magenta,
}

const CANDIDATES: Record<PrStatus, Icon[]> = {
  review: [
    ['oct', 'eye', 0xf441],
    ['oct', 'code_review', 0xf4af],
    ['oct', 'git_pull_request', 0xf407],
    ['oct', 'comment_discussion', 0xf442],
    ['oct', 'dot_fill', 0xf444],
    ['oct', 'hourglass', 0xf4e3],
    ['oct', 'clock', 0xf43a],
    ['cod', 'eye', 0xea70],
    ['cod', 'git_pull_request', 0xea64],
    ['cod', 'comment_discussion', 0xeac7],
    ['md', 'eye_outline', 0xf06d0],
    ['md', 'timer_sand', 0xf051f],
  ],
  approved: [
    ['oct', 'check', 0xf42e],
    ['oct', 'check_circle', 0xf49e],
    ['oct', 'check_circle_fill', 0xf4a4],
    ['oct', 'verified', 0xf4a1],
    ['oct', 'thumbsup', 0xf496],
    ['oct', 'shield_check', 0xf510],
    ['cod', 'verified', 0xeb77],
    ['cod', 'verified_filled', 0xebe9],
    ['cod', 'pass', 0xeba4],
    ['cod', 'thumbsup', 0xeb6c],
    ['md', 'check_decagram', 0xf0791],
    ['md', 'thumb_up', 0xf0513],
  ],
  ready: [
    ['oct', 'check_circle_fill', 0xf4a4],
    ['oct', 'check_circle', 0xf49e],
    ['oct', 'rocket', 0xf427],
    ['oct', 'git_merge', 0xf419],
    ['oct', 'git_merge_queue', 0xf4db],
    ['oct', 'checklist', 0xf45e],
    ['cod', 'pass_filled', 0xebb3],
    ['cod', 'check_all', 0xebb1],
    ['cod', 'rocket', 0xeb44],
    ['md', 'check_circle', 0xf05e0],
    ['md', 'rocket_launch', 0xf14de],
    ['md', 'source_branch_check', 0xf14cf],
  ],
  rework: [
    ['oct', 'file_diff', 0xf4d2],
    ['oct', 'diff', 0xf440],
    ['oct', 'x_circle', 0xf52f],
    ['oct', 'x', 0xf467],
    ['oct', 'comment', 0xf41f],
    ['oct', 'pencil', 0xf448],
    ['cod', 'request_changes', 0xeb43],
    ['cod', 'diff', 0xeae1],
    ['cod', 'comment_unresolved', 0xec0a],
    ['md', 'file_document_edit', 0xf0dc8],
    ['md', 'pencil_circle', 0xf06ff],
  ],
  behind: [
    ['oct', 'sync', 0xf46a],
    ['oct', 'arrow_down', 0xf433],
    ['oct', 'history', 0xf464],
    ['oct', 'move_to_bottom', 0xf4ef],
    ['oct', 'repo_pull', 0xf404],
    ['oct', 'download', 0xf409],
  ],
  conflicts: [
    ['cod', 'git_branch_conflicts', 0xec6e],
    ['oct', 'alert', 0xf421],
    ['oct', 'alert_fill', 0xf40c],
    ['oct', 'stop', 0xf46e],
    ['oct', 'x_circle_fill', 0xf530],
    ['oct', 'git_compare', 0xf47f],
    ['oct', 'skip', 0xf517],
    ['cod', 'warning', 0xea6c],
    ['cod', 'error', 0xea87],
    ['cod', 'git_compare', 0xeafd],
    ['md', 'alert', 0xf0026],
    ['md', 'source_branch_remove', 0xf14cc],
    ['md', 'call_split', 0xf00fb],
  ],
  draft: [
    ['oct', 'git_pull_request_draft', 0xf4dd],
    ['oct', 'pencil', 0xf448],
    ['oct', 'circle', 0xf4aa],
    ['oct', 'file', 0xf4a5],
    ['cod', 'git_pull_request_draft', 0xebdb],
    ['cod', 'edit', 0xea73],
    ['md', 'pencil_outline', 0xf0cb6],
    ['md', 'file_document_outline', 0xf09ee],
  ],
  closed: [
    ['oct', 'git_pull_request_closed', 0xf4dc],
    ['oct', 'circle_slash', 0xf468],
    ['oct', 'x_circle', 0xf52f],
    ['oct', 'skip', 0xf517],
    ['cod', 'git_pull_request_closed', 0xebda],
    ['cod', 'circle_slash', 0xeabd],
    ['md', 'close_circle_outline', 0xf015a],
    ['md', 'cancel', 0xf073a],
  ],
  merged: [
    ['oct', 'git_merge', 0xf419],
    ['oct', 'feed_merged', 0xf4c9],
    ['oct', 'git_merge_queue', 0xf4db],
    ['cod', 'git_merge', 0xeafe],
    ['cod', 'merge', 0xebab],
    ['md', 'source_merge', 0xf062d],
    ['md', 'call_merge', 0xf00f8],
  ],
}

// Full sets to compare side by side.
const PRESETS: Record<string, Record<PrStatus, string>> = {
  codicons: {
    review: 'cod-eye',
    approved: 'cod-verified',
    ready: 'cod-pass_filled',
    rework: 'cod-request_changes',
    behind: 'oct-sync',
    conflicts: 'cod-warning',
    draft: 'cod-git_pull_request_draft',
    closed: 'cod-git_pull_request_closed',
    merged: 'cod-git_merge',
  },
  'octicons, picked': {
    review: 'oct-eye',
    approved: 'oct-check',
    ready: 'oct-rocket',
    rework: 'oct-file_diff',
    behind: 'oct-sync',
    conflicts: 'cod-git_branch_conflicts',
    draft: 'oct-git_pull_request_draft',
    closed: 'oct-git_pull_request_closed',
    merged: 'oct-git_merge',
  },
  'octicons, PR shapes': {
    review: 'oct-git_pull_request',
    approved: 'oct-check_circle',
    ready: 'oct-rocket',
    rework: 'oct-x_circle',
    behind: 'oct-arrow_down',
    conflicts: 'oct-alert_fill',
    draft: 'oct-git_pull_request_draft',
    closed: 'oct-git_pull_request_closed',
    merged: 'oct-feed_merged',
  },
}

const STATUSES = Object.keys(CANDIDATES) as PrStatus[]

function find(id: string): Icon {
  for (const list of Object.values(CANDIDATES)) {
    const icon = list.find(([set, name]) => `${set}-${name}` === id)
    if (icon) return icon
  }
  throw new Error(`unknown icon ${id}`)
}

const glyph = ([, , code]: Icon) => String.fromCodePoint(code)
const id = ([set, name]: Icon) => `${set}-${name}`
const hex = ([, , code]: Icon) => code.toString(16)

// A fake branch row, as the TUI shows it.
function row(status: PrStatus, icon: Icon, dim = false) {
  const label = COLORS[status](`${glyph(icon)} ${status}`)
  return `  ○ badge-${status.padEnd(10)} ${pc.green('+1')} ${pc.green('●')}  ${dim ? pc.dim(label) : label}`
}

// ---- Mock view ----

const now = Date.now() / 1000
const HOUR = 3600
const DAY = 24 * HOUR

function branch(name: string, parent: string, fields: Partial<Branch>): Branch {
  return {
    name,
    parent,
    base: null,
    ahead: 1,
    exists: true,
    isCurrent: false,
    changedFiles: 0,
    isMerged: false,
    needsRebase: false,
    unpushed: 0,
    unpulled: 0,
    hasRemote: true,
    prNumber: null,
    committedAt: now - 2 * HOUR,
    ...fields,
  }
}

let prNumber = 40
function pr(title: string, fields: Partial<PrInfo>): PrInfo {
  prNumber++
  return {
    number: prNumber,
    state: 'OPEN',
    title,
    url: '',
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
    mergeStateStatus: 'BLOCKED',
    checksStatus: 'success',
    checks: { total: 5, passed: 5, failing: [], pending: [] },
    ...fields,
  }
}

function stack(number: number, branches: Branch[]): LocalStack {
  return {
    number,
    trunk: 'main',
    branches,
    isActive: branches.some((b) => b.isCurrent),
  }
}

const state: StackState = {
  gitDir: '',
  commonDir: '',
  currentBranch: 'auth/ui',
  defaultBranch: 'main',
  rebase: null,
  stacks: [
    stack(12, [
      branch('auth/models', 'main', {
        isMerged: true,
        exists: false,
        ahead: 0,
        committedAt: null,
      }),
      branch('auth/api', 'main', { ahead: 3, committedAt: now - 1 * DAY }),
      branch('auth/ui', 'auth/api', {
        ahead: 2,
        isCurrent: true,
        changedFiles: 3,
        unpushed: 2,
        committedAt: now - 20 * 60,
      }),
      branch('auth/e2e', 'auth/ui', {
        needsRebase: true,
        unpushed: 1,
        committedAt: now - 3 * DAY,
      }),
    ]),
    stack(13, [
      branch('billing/schema', 'main', {
        ahead: 4,
        unpulled: 1,
        committedAt: now - 5 * DAY,
      }),
      branch('billing/webhooks', 'billing/schema', {
        ahead: 6,
        committedAt: now - 4 * DAY,
      }),
      branch('billing/cleanup', 'billing/webhooks', {
        exists: false,
        ahead: 0,
        committedAt: null,
      }),
    ]),
  ],
  branches: [
    branch('feat/search', 'main', {
      ahead: 5,
      unpushed: 1,
      unpulled: 2,
      committedAt: now - 9 * DAY,
    }),
    branch('fix/typo', 'main', { committedAt: now - 2 * DAY }),
    branch('old/experiment', 'main', { committedAt: now - 95 * DAY }),
    branch('spike/cache', 'main', {
      ahead: 2,
      hasRemote: false,
      committedAt: now - 15 * DAY,
    }),
  ],
}

const prs: Record<string, PrInfo | null> = {
  'auth/models': pr('Add user models', {
    state: 'MERGED',
    mergeStateStatus: 'UNKNOWN',
  }),
  'auth/api': pr('Add auth API', {
    reviewDecision: 'APPROVED',
    mergeStateStatus: 'CLEAN',
  }),
  'auth/ui': pr('Add login screen', {
    checksStatus: 'pending',
    checks: { total: 5, passed: 3, failing: [], pending: ['build', 'e2e'] },
  }),
  'billing/schema': pr('Billing schema', {
    reviewDecision: 'APPROVED',
    checksStatus: 'pending',
    checks: { total: 4, passed: 3, failing: [], pending: ['deploy-preview'] },
  }),
  'billing/webhooks': pr('Stripe webhooks', {
    reviewDecision: 'CHANGES_REQUESTED',
    checksStatus: 'failure',
    checks: { total: 5, passed: 3, failing: ['lint', 'e2e'], pending: [] },
  }),
  'feat/search': pr('Search page', { mergeStateStatus: 'DIRTY' }),
  'fix/typo': pr('Fix typo in footer', {
    reviewDecision: 'APPROVED',
    mergeStateStatus: 'BEHIND',
  }),
  'old/experiment': pr('Try a new router', {
    state: 'CLOSED',
    checksStatus: 'failure',
    checks: { total: 2, passed: 1, failing: ['build'], pending: [] },
  }),
  'auth/e2e': pr('E2E tests for login', {
    isDraft: true,
    checksStatus: null,
    checks: { total: 0, passed: 0, failing: [], pending: [] },
  }),
  'spike/cache': null,
}

const rows = toRows(state)
const selected = rows.findIndex((r) => r.name === 'auth/ui')
const infoRows = ['auth/ui', 'billing/webhooks'].map((name) =>
  rows.find((r) => r.name === name)!,
)
// Ink lays out at 80 columns when the output is not a terminal.
const width = Math.min(process.stdout.columns || 80, 110)

function Frame({ title, children }: { title: string; children: any }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      <Text bold>{title}</Text>
      {children}
    </Box>
  )
}

function MockView() {
  return (
    <Box flexDirection="column">
      <Frame title="Branches">
        <StackList rows={rows} selected={selected} prs={prs} />
      </Frame>
      {infoRows.map((row) => (
        <Frame key={row.name} title={`Info · ${row.name}`}>
          <InfoPane row={row} pr={prs[row.name]} />
        </Frame>
      ))}
    </Box>
  )
}

console.log(pc.bold('\nMock view (real components, made-up data)\n'))
const view = render(<MockView />, { patchConsole: false })
view.unmount()
await view.waitUntilExit()

// The name of an icon from its code point, if it is a candidate.
function nameOf(code: number): string {
  for (const list of Object.values(CANDIDATES)) {
    const icon = list.find(([, , c]) => c === code)
    if (icon) return id(icon)
  }
  return '?'
}

console.log(pc.bold('\nCurrent icons (from PrStatusBadge.tsx)\n'))
for (const status of STATUSES) {
  const { icon, color } = PR_STATUS_STYLES[status]
  const code = icon.codePointAt(0)!
  const paint = pc[color as 'red'] ?? ((s: string) => s)
  const name = pc.dim(`${nameOf(code).padEnd(30)} U+${code.toString(16)}`)
  console.log(
    `  ○ badge-${status.padEnd(10)} ${pc.green('+1')} ${pc.green('●')}  ${paint(`${icon} ${status.padEnd(10)}`)}  ${name}`,
  )
}
console.log()

console.log(pc.bold('CI icon\n'))
const CI_CANDIDATES: Icon[] = [
  ['oct', 'checklist', 0xf45e],
  ['oct', 'tasklist', 0xf4a0],
  ['oct', 'workflow', 0xf52e],
  ['oct', 'play', 0xf500],
  ['oct', 'pulse', 0xf469],
  ['oct', 'beaker', 0xf499],
  ['oct', 'gear', 0xf423],
  ['cod', 'github_action', 0xeaff],
  ['cod', 'checklist', 0xeab3],
  ['cod', 'run_all', 0xeb9e],
  ['md', 'pipe', 0xf07e5],
  ['md', 'test_tube', 0xf0668],
  ['md', 'progress_check', 0xf0995],
  ['md', 'robot', 0xf06a9],
  ['md', 'infinity', 0xf06e4],
]
CI_CANDIDATES.forEach((icon, i) => {
  const g = glyph(icon)
  const n = String(i + 1).padStart(2)
  const current =
    icon[2] === CI_ICON.codePointAt(0) ? pc.bold(' ← current') : ''
  console.log(
    `  ${n}. ${pc.green(`${g} passing`)}  ${pc.yellow(`${g} running`)}  ${pc.red(`${g} failing`)}  ${pc.dim(`${id(icon).padEnd(22)} U+${hex(icon)}`)}${current}`,
  )
})
console.log()

console.log(pc.bold('Presets\n'))
for (const [title, preset] of Object.entries(PRESETS)) {
  console.log(pc.bold(`  ${title}`))
  for (const status of STATUSES) console.log(row(status, find(preset[status])))
  console.log()
}

console.log(pc.bold('Candidates for each status\n'))
for (const status of STATUSES) {
  console.log(pc.bold(`  ${status}`))
  CANDIDATES[status].forEach((icon, i) => {
    const n = String(i + 1).padStart(2)
    const name = pc.dim(`${id(icon).padEnd(30)} U+${hex(icon)}`)
    console.log(
      `  ${n}. ${COLORS[status](`${glyph(icon)} ${status.padEnd(10)}`)}  ${name}`,
    )
  })
  console.log()
}
