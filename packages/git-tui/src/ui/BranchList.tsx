import { useRef, useState } from 'react'
import { MouseButton, type MouseEvent } from '@opentui/core'
import type { Pr } from '#src/data/github'
import type { Row, Section } from '#src/data/model'
import { age, ciIcon, color, prColor, type Color } from './theme'
import { foldKey, needsSync, sectionItems, type Fold } from './listItems'
import type { PrMap } from './query'

// `rail` is the first column: each section draws a line from its header to
// its last item, like a timeline. The trunk has no rail: it starts in the
// first column.
type Line =
  | { type: 'header'; title: string; sync: boolean }
  | { type: 'gap' }
  | { type: 'row'; row: Row; rail: string | null }
  | { type: 'fold'; fold: Fold; rail: string }

// Make one flat list of lines: a header above each stack and above the
// normal branches. The trunk is last, below a gap.
function toLines(
  sections: Section[],
  prs: PrMap | undefined,
  open: Set<string>,
): Line[] {
  const lines: Line[] = []
  for (const section of sections) {
    if (lines.length) lines.push({ type: 'gap' })
    if (section.kind === 'trunk') {
      for (const row of section.rows)
        lines.push({ type: 'row', row, rail: null })
      continue
    }
    lines.push({
      type: 'header',
      title: section.title,
      sync: needsSync(section, prs),
    })
    const items = sectionItems(section, prs, open)
    items.forEach((item, i) => {
      const rail = i === items.length - 1 ? '╰' : '│'
      lines.push(
        item.type === 'row'
          ? { type: 'row', row: item.row, rail }
          : { type: 'fold', fold: item.fold, rail },
      )
    })
  }
  return lines
}

// The key of a line, as listItems makes it. Null for a line that cannot be
// selected.
function lineKey(line: Line): string | null {
  if (line.type === 'row') return line.row.name
  if (line.type === 'fold') return foldKey(line.fold.key)
  return null
}

// Keep the selected line in view. Move the window only when the selection
// leaves it, so that the list does not jump.
function useWindow(selectedLine: number, total: number, height: number) {
  const offset = useRef(0)
  const max = Math.max(0, total - height)
  if (selectedLine < offset.current) offset.current = selectedLine
  if (selectedLine >= offset.current + height) {
    offset.current = selectedLine - height + 1
  }
  // Show the header above the first row of a stack.
  if (selectedLine - offset.current < 2 && offset.current > 0) {
    offset.current = Math.max(0, selectedLine - 2)
  }
  offset.current = Math.min(Math.max(0, offset.current), max)
  return offset.current
}

function Badges({
  row,
  pr,
  merged,
  selected,
  changedFiles,
}: {
  row: Row
  pr: Pr | undefined
  merged: boolean
  selected: boolean
  changedFiles: number
}) {
  const dim = selected ? color.text : color.dim
  const parts: Array<[string, Color]> = []
  if (row.isCurrent && changedFiles)
    parts.push([`✎${changedFiles}`, color.yellow])
  if (row.kind === 'trunk') {
    if (row.unpulled) parts.push([`⇣${row.unpulled}`, color.magenta])
    if (row.unpushed) parts.push([`⇡${row.unpushed}`, color.red])
  } else if (!row.exists) {
    // A merged branch that sync deleted shows its merged PR only.
    if (!merged) parts.push(['deleted', dim])
  } else if (!merged) {
    // A merged branch is done. Its push and rebase state do not matter.
    if (row.ahead) parts.push([`+${row.ahead}`, dim])
    if (row.behind) parts.push([`⚠ rebase`, color.yellow])
    if (row.unpushed) parts.push([`⇡${row.unpushed}`, color.cyan])
    if (row.unpulled) parts.push([`⇣${row.unpulled}`, color.magenta])
    if (row.upstreamGone) parts.push(['gone', dim])
    else if (!row.hasRemote) parts.push(['local', dim])
  }
  // A merged branch shows its PR number only: the dot already says merged.
  if (pr && merged) parts.push([`#${pr.number}`, dim])
  else if (pr) parts.push([`#${pr.number} ${pr.status}`, prColor(pr.status)])
  const ci = ciIcon(merged ? 'none' : (pr?.ci ?? 'none'))
  return (
    <text flexShrink={0}>
      {parts.map(([label, fg], i) => (
        <span key={i} fg={fg}>
          {label}{' '}
        </span>
      ))}
      <span fg={ci.fg}>{ci.icon}</span>
      <span fg={dim}>{age(row.committedAt).padStart(4)}</span>
    </text>
  )
}

// Two clicks on the same row within this time are a double-click.
const DOUBLE_CLICK_MS = 400

// The dot of a row: its state at a glance.
// The icon of a branch. Merged comes before current: a merged PR on the
// current branch must show. Then the ✓ is green, the color of the current
// branch.
function dot(row: Row, merged: boolean): { icon: string; fg: Color } {
  if (merged && row.kind !== 'trunk')
    return { icon: '✓', fg: row.isCurrent ? color.green : color.magenta }
  if (row.isCurrent) return { icon: '●', fg: color.green }
  if (row.kind === 'trunk') return { icon: '◆', fg: color.accent }
  if (!row.exists) return { icon: '·', fg: color.dim }
  return { icon: '○', fg: row.stack ? color.accent : color.dim }
}

function RowLine({
  row,
  rail,
  selected,
  prs,
  changedFiles,
  onClick,
}: {
  row: Row
  rail: string | null
  selected: boolean
  prs: PrMap | undefined
  changedFiles: number
  onClick: (name: string, event: MouseEvent) => void
}) {
  const [hover, setHover] = useState(false)
  const pr = prs?.[row.name]
  const merged = row.merged || pr?.status === 'merged'
  const dimmed = merged || !row.exists
  const dim = selected ? color.text : color.dim
  const { icon, fg } = dot(row, merged)
  // Only a stack branch has a position. The other names start right after
  // the dot.
  // The positions of a stack have the same width, so that the names of the
  // stack start in the same column.
  const position = row.stack
    ? ` ${`${row.stack.position}`.padStart(`${row.stack.size}`.length)} `
    : ' '
  return (
    <box
      flexDirection="row"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={selected ? color.selected : undefined}
      onMouseDown={(event) => onClick(row.name, event)}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      <text flexGrow={1} flexShrink={1} wrapMode="none" truncate>
        {rail !== null && <span fg={color.faint}>{rail} </span>}
        <span fg={fg}>{icon}</span>
        <span fg={dim}>{position}</span>
        <span fg={dimmed ? dim : color.text}>
          {row.kind === 'trunk' ? (
            <strong>{row.name}</strong>
          ) : hover && !selected && row.exists ? (
            <u>{row.name}</u>
          ) : (
            row.name
          )}
        </span>
      </text>
      <Badges
        row={row}
        pr={pr}
        merged={merged}
        selected={selected}
        changedFiles={changedFiles}
      />
    </box>
  )
}

// One line for the merged branches of a stack. A click opens it.
function FoldLine({
  fold,
  rail,
  selected,
  prs,
  onClick,
}: {
  fold: Fold
  rail: string
  selected: boolean
  prs: PrMap | undefined
  onClick: (key: string, event: MouseEvent) => void
}) {
  const [hover, setHover] = useState(false)
  const dim = selected ? color.text : color.dim
  const positions = fold.rows.map((r) => r.stack?.position ?? 0)
  const range = `${Math.min(...positions)}–${Math.max(...positions)}`
  const numbers = fold.rows
    .map((r) => prs?.[r.name]?.number)
    .filter(Boolean)
    .map((n) => `#${n}`)
    .join(' ')
  const label = `${fold.rows.length} merged`
  return (
    <box
      flexDirection="row"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={selected ? color.selected : undefined}
      onMouseDown={(event) => onClick(foldKey(fold.key), event)}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      <text flexGrow={1} flexShrink={1} wrapMode="none" truncate>
        <span fg={color.faint}>{rail} </span>
        <span fg={color.magenta}>✓</span>
        <span fg={dim}> {range} </span>
        <span fg={dim}>{hover && !selected ? <u>{label}</u> : label}</span>
        <span fg={color.faint}> ▸</span>
      </text>
      <text flexShrink={0} fg={dim}>
        {numbers}
      </text>
    </box>
  )
}

export function BranchList({
  sections,
  open,
  selected,
  prs,
  height,
  changedFiles,
  onSelect,
  onActivate,
  onScroll,
  onMenu,
}: {
  sections: Section[]
  // The stacks with an open fold. See listItems.
  open: Set<string>
  // The key of the selected item: a branch name, or the key of a fold.
  selected: string | undefined
  prs: PrMap | undefined
  height: number
  changedFiles: number
  onSelect: (name: string) => void
  // A double-click on a row.
  onActivate: (name: string) => void
  onScroll: (down: boolean) => void
  // A right click on a row: open its menu at the cell of the click.
  onMenu: (name: string, x: number, y: number) => void
}) {
  const lastClick = useRef({ name: '', at: 0 })
  const click = (name: string, event: MouseEvent) => {
    if (event.button === MouseButton.RIGHT) {
      return onMenu(name, event.x, event.y)
    }
    const now = Date.now()
    const double =
      lastClick.current.name === name &&
      now - lastClick.current.at < DOUBLE_CLICK_MS
    lastClick.current = { name, at: double ? 0 : now }
    if (double) onActivate(name)
    else onSelect(name)
  }
  const lines = toLines(sections, prs, open)
  const selectedLine = Math.max(
    0,
    lines.findIndex((l) => lineKey(l) === selected),
  )
  const offset = useWindow(selectedLine, lines.length, height)
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      onMouseScroll={(event) => {
        const direction = event.scroll?.direction
        if (direction === 'up' || direction === 'down') {
          onScroll(direction === 'down')
        }
      }}
    >
      {lines.slice(offset, offset + height).map((line, i) => {
        if (line.type === 'gap')
          return <box key={`gap${offset + i}`} height={1} />
        if (line.type === 'header') {
          return (
            <box
              key={`h${offset + i}`}
              flexDirection="row"
              height={1}
              paddingLeft={1}
              paddingRight={1}
            >
              <text flexGrow={1} wrapMode="none" truncate>
                <span fg={color.faint}>╭─ </span>
                <span fg={color.dim}>{line.title}</span>
              </text>
              {/* Merged branches are still local: a sync deletes them, and
                  rebases the branches above them. */}
              {line.sync && (
                <text flexShrink={0} fg={color.yellow}>
                  ⟳ S to sync
                </text>
              )}
            </box>
          )
        }
        if (line.type === 'fold') {
          return (
            <FoldLine
              key={foldKey(line.fold.key)}
              fold={line.fold}
              rail={line.rail}
              selected={foldKey(line.fold.key) === selected}
              prs={prs}
              onClick={click}
            />
          )
        }
        return (
          <RowLine
            key={line.row.name}
            row={line.row}
            rail={line.rail}
            selected={line.row.name === selected}
            prs={prs}
            changedFiles={changedFiles}
            onClick={click}
          />
        )
      })}
    </box>
  )
}
