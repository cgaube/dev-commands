import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Commit, Repo } from '#src/data/git'
import type { Pr, Review } from '#src/data/github'
import type { Row } from '#src/data/model'
import type { Fold } from './listItems'
import { HintBar } from './Kbd'
import { commitsQuery, prCommitsQuery, type PrMap } from './query'
import { age, checkIcon, color, prColor, type Color } from './theme'

// The most lines that one list in the pane shows.
const MAX_CHECKS = 8
const MAX_FILES = 8
// The width of the label column of a field.
const LABEL_WIDTH = 10
// The most diamonds that the CI line shows.
const BAR_WIDTH = 16

function Heading({ children }: { children: string }) {
  return (
    <text fg={color.accent} marginTop={1}>
      <strong>{children}</strong>
    </text>
  )
}

// One line of the pane: a dim label on the left, the value on the right.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <box flexDirection="row" height={1}>
      <text width={LABEL_WIDTH} flexShrink={0} fg={color.dim}>
        {label}
      </text>
      <text flexGrow={1} flexShrink={1} wrapMode="none" truncate>
        {children}
      </text>
    </box>
  )
}

// A word on a colored background, for example the status of the PR.
function Pill({ text, bg }: { text: string; bg: Color }) {
  return (
    <text flexShrink={0}>
      <span fg={color.background} bg={bg}>
        <strong>{` ${text.toUpperCase()} `}</strong>
      </span>
    </text>
  )
}

// A line that opens something on click. It is underlined while the mouse is
// over it.
function Link({
  onClick,
  children,
}: {
  onClick: () => void
  children: (hover: boolean) => ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <text
      wrapMode="none"
      truncate
      onMouseDown={onClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      {children(hover)}
    </text>
  )
}

// "2d ago" for an ISO date.
function ago(iso: string | null | undefined): string {
  return iso ? `${age(Date.parse(iso) / 1000)} ago` : ''
}

// The stack as one line, from the trunk to the top. The selected branch is
// highlighted, and merged branches are dim, with a check mark.
function StackMap({
  row,
  rows,
  prs,
  highlight = [row.name],
}: {
  row: Row
  rows: Row[]
  prs: PrMap | undefined
  // The branches to highlight. By default, the selected branch.
  highlight?: string[]
}) {
  const stack = row.stack
  if (!stack) return null
  const id = stack.number ? `stack #${stack.number}` : 'local stack'
  return (
    <text wrapMode="none" truncate>
      <span fg={color.dim}>{id} </span>
      <span fg={color.dim}> {stack.trunk}</span>
      {stack.branches.map((name, i) => {
        const other = rows.find((r) => r.name === name)
        const merged = other?.merged || prs?.[name]?.status === 'merged'
        const label = ` ${i + 1}${merged ? '✓' : ''} `
        return (
          <span key={name}>
            <span fg={color.faint}> › </span>
            {highlight.includes(name) ? (
              <span fg={color.background} bg={color.accent}>
                <strong>{label}</strong>
              </span>
            ) : (
              <span fg={merged ? color.dim : color.text}>{label}</span>
            )}
          </span>
        )
      })}
    </text>
  )
}

// The icon and the color of a review. Functions, because the colors change
// with the theme.
const reviewIcon = (state: Review['state']): { icon: string; fg: Color } =>
  ({
    approved: { icon: '✓', fg: color.green },
    changes: { icon: '✗', fg: color.red },
    commented: { icon: '○', fg: color.dim },
    requested: { icon: '●', fg: color.yellow },
  })[state]

// One diamond for each check: ◆ for a check that is done (red failed,
// green passed), ◇ for a check that runs (yellow) or was skipped (faint).
// The failed checks come first. With more than BAR_WIDTH checks, each
// group gets its share of the diamonds, and at least one.
function CiBar({ pr }: { pr: Pr }) {
  const count = (state: string) =>
    pr.checks.filter((c) => c.state === state).length
  const total = pr.checks.length
  const parts: Array<[number, string, Color]> = [
    [count('failed'), '◆', color.red],
    [count('passed'), '◆', color.green],
    [count('pending'), '◇', color.yellow],
    [count('skipped'), '◇', color.faint],
  ]
  const cells =
    total <= BAR_WIDTH
      ? parts.map(([n]) => n)
      : parts.map(([n]) =>
          n ? Math.max(1, Math.round((n / total) * BAR_WIDTH)) : 0,
        )
  while (cells.reduce((a, b) => a + b, 0) > BAR_WIDTH) {
    cells[cells.indexOf(Math.max(...cells))]--
  }
  return (
    <>
      {parts.map(([, icon, fg], i) => (
        <span key={i} fg={fg}>
          {icon.repeat(cells[i])}
        </span>
      ))}
    </>
  )
}

function PrSection({
  row,
  pr,
  loading,
  onOpenPr,
  onOpenUrl,
}: {
  row: Row
  pr: Pr | undefined
  loading: boolean
  onOpenPr: () => void
  onOpenUrl: (url: string) => void
}) {
  if (!pr) {
    return (
      <text fg={color.dim} marginTop={1}>
        {loading ? 'loading the PR…' : 'no PR yet · P creates one'}
      </text>
    )
  }
  const failed = pr.checks.filter((c) => c.state === 'failed')
  const pending = pr.checks.filter((c) => c.state === 'pending')
  const passed = pr.checks.filter((c) => c.state === 'passed').length
  // Show the checks that need attention.
  const shown = [...failed, ...pending].slice(0, MAX_CHECKS)
  const reviews = pr.reviews ?? []
  const open = pr.status !== 'merged' && pr.status !== 'closed'
  // An open PR must go into the parent branch, for example the branch below
  // it in a stack.
  const wrongBase = open && !!pr.baseRef && pr.baseRef !== row.parent
  return (
    <>
      <box marginTop={1}>
        <Link onClick={onOpenPr}>
          {(hover) => (
            <>
              <span fg={color.accent}>#{pr.number} </span>
              <strong fg={color.text}>
                {hover ? <u>{pr.title}</u> : pr.title}
              </strong>
            </>
          )}
        </Link>
      </box>
      {pr.author !== undefined && (
        <Field label="author">
          <span fg={color.text}>{pr.author ?? 'unknown'}</span>
          <span fg={color.dim}> · opened {ago(pr.createdAt)}</span>
          {pr.mergedAt && (
            <span fg={color.magenta}> · merged {ago(pr.mergedAt)}</span>
          )}
        </Field>
      )}
      {pr.baseRef && (
        <Field label="base">
          <span fg={wrongBase ? color.yellow : color.text}>{pr.baseRef}</span>
          {wrongBase && <span fg={color.yellow}> ⚠ expected {row.parent}</span>}
        </Field>
      )}
      {pr.additions !== undefined && (
        <Field label="size">
          <span fg={color.green}>+{pr.additions}</span>
          <span fg={color.red}> −{pr.deletions}</span>
          <span fg={color.dim}>
            {' '}
            · {pr.changedFiles} file{pr.changedFiles === 1 ? '' : 's'}
          </span>
        </Field>
      )}
      {pr.reviews && (
        <Field label="reviews">
          {reviews.length === 0 ? (
            <span fg={color.dim}>none yet</span>
          ) : (
            reviews.map((r) => (
              <span key={r.login} fg={reviewIcon(r.state).fg}>
                {reviewIcon(r.state).icon} {r.login}
                {'   '}
              </span>
            ))
          )}
        </Field>
      )}
      {pr.comments || pr.unresolvedThreads ? (
        <Field label="threads">
          {pr.unresolvedThreads ? (
            <span fg={color.yellow}>{pr.unresolvedThreads} unresolved · </span>
          ) : null}
          <span fg={color.dim}>
            {pr.comments} comment{pr.comments === 1 ? '' : 's'}
          </span>
        </Field>
      ) : null}
      <Field label="CI">
        {pr.checks.length === 0 ? (
          <span fg={color.dim}>no checks</span>
        ) : (
          <>
            <CiBar pr={pr} />
            <span fg={color.text}>
              {' '}
              {passed}/{pr.checks.length} passed
            </span>
            {failed.length > 0 && (
              <span fg={color.red}> · {failed.length} failed</span>
            )}
            {pending.length > 0 && (
              <span fg={color.yellow}> · {pending.length} running</span>
            )}
          </>
        )}
      </Field>
      {shown.map((check, i) => (
        <box key={i} paddingLeft={LABEL_WIDTH}>
          <Link onClick={() => check.url && onOpenUrl(check.url)}>
            {(hover) => (
              <>
                <span fg={checkIcon(check.state).fg}>
                  {checkIcon(check.state).icon}{' '}
                </span>
                <span fg={color.text}>
                  {hover && check.url ? <u>{check.name}</u> : check.name}
                </span>
              </>
            )}
          </Link>
        </box>
      ))}
    </>
  )
}

function LocalSection({
  row,
  repo,
  merged,
}: {
  row: Row
  repo: Repo
  merged: boolean
}) {
  const notes: Array<[string, Color]> = []
  if (!row.exists) notes.push(['deleted locally (merged)', color.dim])
  if (row.unpushed) notes.push([`⇡ ${row.unpushed} to push`, color.cyan])
  if (row.unpulled) notes.push([`⇣ ${row.unpulled} to pull`, color.magenta])
  if (row.kind !== 'trunk' && row.behind && !merged) {
    notes.push([
      `⚠ ${row.parent} has ${row.behind} new commits: press r`,
      color.yellow,
    ])
  }
  if (row.exists && !row.hasRemote && row.kind !== 'trunk' && !merged) {
    notes.push(['not pushed yet', color.dim])
  }
  const changed = row.isCurrent ? repo.changes : []
  if (!notes.length && !changed.length) return null
  return (
    <>
      <Heading>Local</Heading>
      {notes.length > 0 && (
        <Field label="state">
          {notes.map(([text, fg], i) => (
            <span key={i} fg={fg}>
              {i ? ' · ' : ''}
              {text}
            </span>
          ))}
        </Field>
      )}
      {changed.length > 0 && (
        <Field label="changes">
          <span fg={color.yellow}>
            ✎ {changed.length} file{changed.length > 1 ? 's' : ''} not committed
          </span>
        </Field>
      )}
      {changed.slice(0, MAX_FILES).map((line, i) => (
        <box key={i} paddingLeft={LABEL_WIDTH}>
          <text fg={color.dim} wrapMode="none" truncate>
            {line}
          </text>
        </box>
      ))}
      {changed.length > MAX_FILES && (
        <box paddingLeft={LABEL_WIDTH}>
          <text fg={color.dim}>+{changed.length - MAX_FILES} more</text>
        </box>
      )}
    </>
  )
}

function CommitsSection({
  row,
  repo,
  pr,
}: {
  row: Row
  repo: Repo
  pr: Pr | undefined
}) {
  const sha = repo.branches.get(row.name)?.sha
  const local = useQuery(
    commitsQuery(row.kind === 'trunk' ? undefined : row, sha),
  )
  // A branch that does not exist locally: read the commits of its PR.
  const remote = useQuery(prCommitsQuery(row.exists ? undefined : pr))
  if (row.kind === 'trunk') return null
  if (!row.exists && !pr) return null
  const query = row.exists ? local : remote
  const list = (row.exists ? local.data?.commits : remote.data) ?? []
  const base = row.exists ? local.data?.base : undefined
  const count = row.exists ? row.ahead : list.length
  const source = row.exists ? '' : ` · from PR #${pr?.number}`
  return (
    <>
      <Heading>
        {query.isLoading
          ? `Commits${source}`
          : `Commits (${count}), newest first${source}`}
      </Heading>
      {query.isLoading && <text fg={color.dim}>loading…</text>}
      {query.isError && <text fg={color.red}>could not read the commits</text>}
      {!query.isLoading && !query.isError && list.length === 0 && (
        <text fg={color.dim}>no commits yet</text>
      )}
      {list.map((c) => (
        <CommitLine key={c.sha} commit={c} />
      ))}
      {/* The parent commit that the branch starts from, dimmed. */}
      {base && (
        <>
          {/* No truncate: it puts "..." in the middle of the line. */}
          <text fg={color.faint} wrapMode="none">
            {`── ${row.parent} ${'─'.repeat(200)}`}
          </text>
          <CommitLine commit={base} dimmed />
        </>
      )}
    </>
  )
}

function CommitLine({
  commit,
  dimmed = false,
}: {
  commit: Commit
  dimmed?: boolean
}) {
  return (
    <box flexDirection="row" height={1}>
      <text fg={dimmed ? color.dim : color.yellow} flexShrink={0}>
        {commit.sha}{' '}
      </text>
      <text
        fg={dimmed ? color.dim : color.text}
        flexGrow={1}
        flexShrink={1}
        wrapMode="none"
        truncate
      >
        {commit.subject}
      </text>
      <text fg={color.dim} flexShrink={0}>
        {age(commit.committedAt).padStart(4)}
      </text>
    </box>
  )
}

export function Details({
  row,
  rows,
  repo,
  pr,
  prs,
  prsLoading,
  onOpenPr,
  onOpenUrl,
}: {
  row: Row | undefined
  rows: Row[]
  repo: Repo
  pr: Pr | undefined
  prs: PrMap | undefined
  prsLoading: boolean
  onOpenPr: () => void
  onOpenUrl: (url: string) => void
}) {
  if (!row) return null
  const merged = row.merged || pr?.status === 'merged'
  return (
    <box
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      flexShrink={0}
      flexGrow={1}
    >
      <box flexDirection="row" height={1} gap={2}>
        <text flexGrow={1} flexShrink={1} wrapMode="none" truncate>
          <strong fg={color.text}>{row.name}</strong>
        </text>
        {pr && <Pill text={pr.status} bg={prColor(pr.status)} />}
      </box>
      {row.stack ? (
        <StackMap row={row} rows={rows} prs={prs} />
      ) : (
        <text fg={color.dim}>
          {row.kind === 'trunk' ? 'default branch' : `from ${row.parent}`}
        </text>
      )}
      {row.kind !== 'trunk' && (
        <PrSection
          row={row}
          pr={pr}
          loading={prsLoading}
          onOpenPr={onOpenPr}
          onOpenUrl={onOpenUrl}
        />
      )}
      <LocalSection row={row} repo={repo} merged={merged} />
      {/* The commits go to the bottom of the pane, so that the PR data has
          room at the top. */}
      <box flexGrow={1} minHeight={1} />
      <box flexDirection="column" flexShrink={0}>
        <CommitsSection row={row} repo={repo} pr={pr} />
      </box>
    </box>
  )
}

// The details of a fold: the merged branches of a stack. Each line is one
// merged PR (click it to open the PR). The last line tells the next step.
export function FoldDetails({
  fold,
  rows,
  prs,
  onOpenUrl,
}: {
  fold: Fold
  rows: Row[]
  prs: PrMap | undefined
  onOpenUrl: (url: string) => void
}) {
  const first = fold.rows[0]
  const stack = first.stack
  const stackRows = (stack?.branches ?? [])
    .map((name) => rows.find((r) => r.name === name))
    .filter((r): r is Row => !!r)
  const merged = (r: Row) => r.merged || prs?.[r.name]?.status === 'merged'
  // The widths of the columns on the right.
  const widest = (f: (pr: Pr) => string) =>
    Math.max(
      0,
      ...fold.rows.map((r) => (prs?.[r.name] ? f(prs[r.name]) : '').length),
    )
  const widths = {
    when: widest((pr) => (pr.mergedAt ? `merged ${ago(pr.mergedAt)}` : '')),
    added: widest((pr) =>
      pr.additions !== undefined ? `+${pr.additions}` : '',
    ),
    removed: widest((pr) =>
      pr.deletions !== undefined ? `−${pr.deletions}` : '',
    ),
  }
  const next = fold.rows.some((r) => r.exists)
    ? { key: 'S', text: 'sync: delete the merged branches, rebase the others' }
    : stackRows.every((r) => !r.exists || merged(r))
      ? { key: 'd', text: 'remove the finished stack (it stays on GitHub)' }
      : { key: 'return', text: 'show the branches' }
  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1} flexShrink={0}>
      <box flexDirection="row" height={1} gap={2}>
        <text flexGrow={1} flexShrink={1} wrapMode="none" truncate>
          <strong fg={color.text}>{fold.rows.length} merged branches</strong>
        </text>
        <Pill text="merged" bg={color.magenta} />
      </box>
      <StackMap
        row={first}
        rows={rows}
        prs={prs}
        highlight={fold.rows.map((r) => r.name)}
      />
      <box marginTop={1} flexDirection="column">
        {fold.rows.map((r) => {
          const pr = prs?.[r.name]
          // Pad the columns on the right, so that they line up.
          const when = pr?.mergedAt ? `merged ${ago(pr.mergedAt)}` : ''
          const added = pr?.additions !== undefined ? `+${pr.additions}` : ''
          const removed = pr?.deletions !== undefined ? `−${pr.deletions}` : ''
          return (
            <box key={r.name} flexDirection="row" height={1} gap={2}>
              <box flexGrow={1} flexShrink={1}>
                <Link onClick={() => pr && onOpenUrl(pr.url)}>
                  {(hover) =>
                    pr ? (
                      <>
                        <span fg={color.accent}>#{pr.number} </span>
                        <span fg={color.text}>
                          {hover ? <u>{pr.title}</u> : pr.title}
                        </span>
                      </>
                    ) : (
                      <span fg={color.dim}>{r.name}</span>
                    )
                  }
                </Link>
              </box>
              <text flexShrink={0} fg={color.magenta}>
                {when.padEnd(widths.when)}
              </text>
              <text flexShrink={0}>
                <span fg={color.green}>{added.padStart(widths.added)}</span>
                <span fg={color.red}> {removed.padEnd(widths.removed)}</span>
              </text>
            </box>
          )
        })}
      </box>
      <box flexDirection="row" height={1} marginTop={1}>
        <text width={LABEL_WIDTH} flexShrink={0} fg={color.dim}>
          next
        </text>
        <HintBar
          items={[{ key: next.key, label: next.text, clickable: false }]}
        />
      </box>
    </box>
  )
}

// A banner while a rebase stopped on a conflict. It tells the next step.
// The key caps are clickable.
export function RebaseBanner({
  repo,
  agentEnabled,
  onPress,
}: {
  repo: Repo
  // False when Claude is not installed or is off. Then show the manual steps.
  agentEnabled: boolean
  onPress: (key: string) => void
}) {
  if (!repo.rebase) return null
  const count = repo.conflicts.length
  return (
    <box
      border
      borderColor={count ? color.red : color.yellow}
      paddingLeft={1}
      flexDirection="column"
      flexShrink={0}
    >
      {count > 0 ? (
        <>
          <text fg={color.red}>
            <strong>
              Rebase stopped: {count} file{count > 1 ? 's' : ''} with conflicts
            </strong>
          </text>
          <text fg={color.dim} wrapMode="none" truncate>
            {repo.conflicts.slice(0, 4).join(', ')}
            {count > 4 ? ` +${count - 4}` : ''}
          </text>
          {!agentEnabled && (
            <text fg={color.text} wrapMode="word">
              Edit the files, git add them, then press c.
            </text>
          )}
          <HintBar
            items={[
              ...(agentEnabled ? [{ key: 'a', label: 'fix with Claude' }] : []),
              { key: 'c', label: 'continue' },
              { key: 'A', label: 'abort' },
            ]}
            onPress={onPress}
          />
        </>
      ) : (
        <>
          <text fg={color.yellow}>Rebase in progress, no conflicts left.</text>
          <HintBar
            items={[
              { key: 'c', label: 'continue' },
              { key: 'A', label: 'abort' },
            ]}
            onPress={onPress}
          />
        </>
      )}
    </box>
  )
}
