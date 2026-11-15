import { stripVTControlCharacters } from 'node:util'
import { colors } from '#common/style'
import {
  closure,
  isThirdPartyTap,
  type BrewState,
  type RootSummary,
} from './data'

const visibleLength = (text: string) => stripVTControlCharacters(text).length
const padEnd = (text: string, width: number) =>
  text + ' '.repeat(Math.max(0, width - visibleLength(text)))
const padStart = (text: string, width: number) =>
  ' '.repeat(Math.max(0, width - visibleLength(text))) + text

const truncate = (text: string, width: number) =>
  width <= 1 ? '' : text.length > width ? `${text.slice(0, width - 1)}…` : text

export function formatSize(kb: number): string {
  if (kb < 1024) return `${kb}K`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)}M`
  return `${(mb / 1024).toFixed(1)}G`
}

export function formatAge(epochSeconds: number | null): string {
  if (epochSeconds == null) return '—'
  const days = (Date.now() / 1000 - epochSeconds) / 86400
  if (days < 1) return 'today'
  if (days < 30) return `${Math.floor(days)}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

type Column = {
  header: string
  align?: 'right'
  cells: string[]
  /** Last column only: styled text kept visible after the truncated cell */
  tails?: string[]
}

/** Lay out columns; the last column takes the remaining terminal width */
function table(columns: Column[]): string[] {
  const widths = columns.map((c) =>
    Math.max(visibleLength(c.header), ...c.cells.map(visibleLength)),
  )
  const gap = '  '
  const fixedWidth =
    widths.slice(0, -1).reduce((a, b) => a + b, 0) +
    gap.length * (columns.length - 1)
  // 3 columns are taken by the clack gutter
  const lastWidth = Math.max(
    10,
    (process.stdout.columns || 120) - 3 - fixedWidth,
  )

  const row = (cells: string[]) =>
    cells
      .map((cell, i) => {
        const col = columns[i]!
        if (i === columns.length - 1) return cell
        return col.align === 'right'
          ? padStart(cell, widths[i]!)
          : padEnd(cell, widths[i]!)
      })
      .join(gap)

  const rowCount = columns[0]!.cells.length
  const lines = [colors.dim(row(columns.map((c) => c.header)))]
  for (let r = 0; r < rowCount; r++) {
    lines.push(
      row(
        columns.map((c, i) => {
          const cell = c.cells[r]!
          if (i !== columns.length - 1) return cell
          const tail = c.tails?.[r] ?? ''
          if (!tail) return truncate(cell, lastWidth)
          const room = lastWidth - visibleLength(tail) - 2
          const text = truncate(cell, room)
          return text ? `${text}  ${tail}` : tail
        }),
      ),
    )
  }
  return lines
}

function flags(parts: {
  outdated?: boolean
  pinned?: boolean
  tap?: string
  neededBy?: string[]
}): string {
  const out: string[] = []
  if (parts.outdated) out.push(colors.yellow('outdated'))
  if (parts.pinned) out.push(colors.cyan('pinned'))
  if (parts.tap && isThirdPartyTap(parts.tap))
    out.push(colors.magenta(parts.tap))
  if (parts.neededBy?.length) {
    const [first, ...rest] = parts.neededBy
    const more = rest.length ? ` +${rest.length}` : ''
    out.push(colors.blue(`needed by ${first}${more}`))
  }
  return out.join(' ')
}

export type SortKey = 'size' | 'name' | 'updated'

const sorters: Record<
  SortKey,
  (state: BrewState) => (a: RootSummary, b: RootSummary) => number
> = {
  size: () => (a, b) => b.totalKb - a.totalKb,
  name: () => (a, b) => a.name.localeCompare(b.name),
  updated: (state) => (a, b) =>
    (state.formulae.get(a.name)!.installedAt ?? 0) -
    (state.formulae.get(b.name)!.installedAt ?? 0),
}

export function renderRoots(state: BrewState, sort: SortKey): string {
  const roots = [...state.roots].sort(sorters[sort](state))
  const lines = table([
    {
      header: 'FORMULA',
      cells: roots.map((r) => colors.bold(r.name)),
    },
    {
      header: 'FREES',
      align: 'right',
      // A root that another root needs cannot be removed on its own
      cells: roots.map((r) =>
        r.neededBy.length ? colors.dim('—') : formatSize(r.totalKb),
      ),
    },
    {
      header: 'OWN',
      align: 'right',
      cells: roots.map((r) =>
        r.exclusive.length ? `${r.exclusive.length}` : colors.dim('0'),
      ),
    },
    {
      header: 'SHARED',
      align: 'right',
      cells: roots.map((r) =>
        r.shared.length ? `${r.shared.length}` : colors.dim('0'),
      ),
    },
    {
      header: 'UPDATED',
      align: 'right',
      cells: roots.map((r) =>
        formatAge(state.formulae.get(r.name)!.installedAt),
      ),
    },
    {
      header: 'DESCRIPTION',
      cells: roots.map((r) => state.formulae.get(r.name)!.desc),
      tails: roots.map((r) =>
        flags({ ...state.formulae.get(r.name)!, neededBy: r.neededBy }),
      ),
    },
  ])
  return lines.join('\n')
}

export function renderCasks(state: BrewState): string {
  const casks = [...state.casks].sort((a, b) => a.token.localeCompare(b.token))
  return table([
    { header: 'CASK', cells: casks.map((c) => colors.bold(c.token)) },
    {
      header: 'UPDATED',
      align: 'right',
      cells: casks.map((c) => formatAge(c.installedAt)),
    },
    {
      header: 'DESCRIPTION',
      cells: casks.map((c) => c.desc),
      tails: casks.map((c) =>
        [
          c.deps.length ? colors.dim(`needs ${c.deps.join(', ')}`) : '',
          flags(c),
        ]
          .filter(Boolean)
          .join(' '),
      ),
    },
  ]).join('\n')
}

export function renderOrphans(state: BrewState): string {
  const total = state.orphans.reduce(
    (sum, name) => sum + state.formulae.get(name)!.sizeKb,
    0,
  )
  const list = state.orphans
    .map((name) => {
      const f = state.formulae.get(name)!
      return `${name} ${colors.dim(formatSize(f.sizeKb))}`
    })
    .join(', ')
  return `${list}\n${colors.dim(`${formatSize(total)} in total — run`)} brew autoremove ${colors.dim('to remove them')}`
}

/** Dependency tree of one formula: exclusive deps normal, shared deps dimmed */
export function renderTree(state: BrewState, name: string): string {
  const root = state.formulae.get(name)!
  const summary = state.roots.find((r) => r.name === name)
  const exclusive = new Set(summary?.exclusive ?? [])
  const expanded = new Set<string>()
  const lines: string[] = []

  const label = (dep: string) => {
    const f = state.formulae.get(dep)!
    const size = colors.dim(formatSize(f.sizeKb))
    if (!summary || exclusive.has(dep)) return `${dep} ${size}`
    const others = (state.usedBy.get(dep) ?? []).filter((r) => r !== name)
    const also = others.length
      ? colors.dim(
          ` also ${others.slice(0, 4).join(', ')}${others.length > 4 ? ` +${others.length - 4}` : ''}`,
        )
      : f.onRequest
        ? colors.dim(' installed on request')
        : ''
    return `${colors.dim(dep)} ${size}${also}`
  }

  const children = (node: string) => {
    const f = state.formulae.get(node)!
    return [
      ...f.deps.map((dep) => ({ dep, build: false })),
      ...f.buildDeps.map((dep) => ({ dep, build: true })),
    ].sort((a, b) => a.dep.localeCompare(b.dep))
  }

  const walk = (node: string, prefix: string) => {
    const deps = children(node)
    deps.forEach(({ dep, build }, i) => {
      const last = i === deps.length - 1
      const branch = last ? '└─ ' : '├─ '
      const text = `${prefix}${branch}${label(dep)}${build ? colors.dim(' (build)') : ''}`
      if (expanded.has(dep) && children(dep).length > 0) {
        lines.push(`${text} ${colors.dim('↑')}`)
        return
      }
      expanded.add(dep)
      lines.push(text)
      walk(dep, prefix + (last ? '   ' : '│  '))
    })
  }

  const head = [
    `${colors.bold(name)} ${colors.dim(root.version)} ${formatSize(root.sizeKb)}`,
    root.desc && colors.dim(root.desc),
    flags({ ...root, neededBy: summary?.neededBy }),
  ].filter(Boolean)
  lines.push(head.join('  '))
  walk(name, '')

  if (root.needs.length === 0) lines.push(colors.dim('no dependencies'))

  // Deps from older install receipts that the current formula no longer uses
  const fromReceipt = [...closure([name], state.formulae)].filter(
    (dep) => !expanded.has(dep),
  )
  if (fromReceipt.length > 0) {
    lines.push(
      colors.dim(
        `also kept from the install receipt (reinstall ${name} to drop): `,
      ) + fromReceipt.sort().map(label).join(', '),
    )
  }

  lines.push('')
  if (summary) {
    if (summary.neededBy.length > 0) {
      lines.push(
        colors.yellow(
          `${name} is needed by ${summary.neededBy.join(', ')}: uninstalling it would break ${summary.neededBy.length === 1 ? 'it' : 'them'}`,
        ),
      )
    } else {
      lines.push(
        `uninstalling ${colors.bold(name)} frees ${colors.green(formatSize(summary.totalKb))}` +
          (summary.exclusive.length
            ? ` and removes ${summary.exclusive.length} ${summary.exclusive.length === 1 ? 'dependency' : 'dependencies'}`
            : ''),
      )
    }
    if (summary.shared.length > 0) {
      lines.push(
        colors.dim(
          `${summary.shared.length} shared dependencies stay installed (dimmed)`,
        ),
      )
    }
  } else {
    const users = state.usedBy.get(name) ?? []
    lines.push(
      users.length
        ? `${name} is a dependency of ${users.join(', ')}`
        : colors.yellow(`${name} is an orphan: nothing needs it`),
    )
  }
  return lines.join('\n')
}
