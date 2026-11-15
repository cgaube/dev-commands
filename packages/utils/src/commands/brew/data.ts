import { execa } from 'execa'

type RawRuntimeDep = { full_name: string; declared_directly?: boolean }

type RawFormula = {
  name: string
  full_name: string
  desc: string | null
  tap: string
  pinned: boolean
  outdated: boolean
  dependencies: string[]
  build_dependencies: string[]
  installed: {
    version: string
    poured_from_bottle: boolean
    time: number | null
    installed_on_request: boolean
    runtime_dependencies?: RawRuntimeDep[]
  }[]
}

type RawCask = {
  token: string
  desc: string | null
  tap: string
  outdated: boolean
  installed: string | null
  installed_time: number | null
  depends_on?: { formula?: string[] }
}

export type Formula = {
  name: string
  desc: string
  version: string
  tap: string
  pinned: boolean
  outdated: boolean
  onRequest: boolean
  installedAt: number | null
  /** Size of the formula's own keg, in KB */
  sizeKb: number
  /** Installed formulae this one depends on directly */
  deps: string[]
  /** Installed build dependencies, kept by brew when built from source */
  buildDeps: string[]
  /** Everything brew keeps for this formula: direct, build and receipt deps */
  needs: string[]
  /** Installed formulae that depend on this one directly */
  dependents: string[]
}

export type Cask = {
  token: string
  desc: string
  version: string
  tap: string
  outdated: boolean
  installedAt: number | null
  deps: string[]
}

export type RootSummary = {
  name: string
  /** Dependencies only this root needs: removed along with it */
  exclusive: string[]
  /** Dependencies other roots also need */
  shared: string[]
  /** Own keg size + exclusive dependencies, in KB */
  totalKb: number
  /** Formulae installed on request that also depend on this root */
  neededBy: string[]
}

export type BrewState = {
  formulae: Map<string, Formula>
  casks: Cask[]
  roots: RootSummary[]
  orphans: string[]
  /** For each dependency, the roots (formulae or casks) that pull it in */
  usedBy: Map<string, string[]>
}

const OFFICIAL_TAPS = new Set(['homebrew/core', 'homebrew/cask'])

export const isThirdPartyTap = (tap: string) => !OFFICIAL_TAPS.has(tap)

async function loadSizes(cellar: string): Promise<Map<string, number>> {
  const sizes = new Map<string, number>()
  // One `du` call for every keg is much faster than one per formula
  const { stdout } = await execa('sh', ['-c', `du -sk "${cellar}"/*`], {
    reject: false,
  })
  for (const line of stdout.split('\n')) {
    const [kb, path] = line.split('\t')
    if (!kb || !path) continue
    sizes.set(path.slice(path.lastIndexOf('/') + 1), Number(kb))
  }
  return sizes
}

/** Every installed formula brew keeps for `start` (excluding `start`) */
export function closure(
  start: string[],
  graph: Map<string, { needs: string[] }>,
): Set<string> {
  const seen = new Set<string>()
  const stack = start.flatMap((name) => graph.get(name)?.needs ?? [])
  while (stack.length > 0) {
    const name = stack.pop()!
    if (seen.has(name)) continue
    seen.add(name)
    stack.push(...(graph.get(name)?.needs ?? []))
  }
  return seen
}

export async function loadBrewState(): Promise<BrewState> {
  const [{ stdout: json }, { stdout: cellar }] = await Promise.all([
    execa('brew', ['info', '--json=v2', '--installed']),
    execa('brew', ['--cellar']),
  ])
  const raw = JSON.parse(json) as { formulae: RawFormula[]; casks: RawCask[] }
  const sizes = await loadSizes(cellar.trim())

  // Third-party formulae can be referenced by full name (tap/name)
  const byAnyName = new Map<string, string>()
  for (const f of raw.formulae) {
    byAnyName.set(f.name, f.name)
    byAnyName.set(f.full_name, f.name)
  }
  const resolve = (names: string[]) => [
    ...new Set(names.map((n) => byAnyName.get(n)).filter((n) => n != null)),
  ]

  const formulae = new Map<string, Formula>()
  for (const f of raw.formulae) {
    const keg = f.installed[0]
    if (!keg) continue
    const receipt = keg.runtime_dependencies ?? []
    const direct = receipt
      .filter((d) => d.declared_directly)
      .map((d) => d.full_name)
    const deps = resolve([...direct, ...f.dependencies])
    // Same rules as `brew autoremove`: keep every runtime dependency recorded
    // in the install receipt, and build dependencies of source builds
    const buildDeps = keg.poured_from_bottle
      ? []
      : resolve(f.build_dependencies ?? []).filter((d) => !deps.includes(d))
    const needs = resolve([
      ...deps,
      ...buildDeps,
      ...receipt.map((d) => d.full_name),
    ])
    formulae.set(f.name, {
      name: f.name,
      desc: f.desc ?? '',
      version: keg.version,
      tap: f.tap,
      pinned: f.pinned,
      outdated: f.outdated,
      onRequest: keg.installed_on_request,
      installedAt: keg.time,
      sizeKb: sizes.get(f.name) ?? 0,
      deps,
      buildDeps,
      needs,
      dependents: [],
    })
  }
  for (const f of formulae.values()) {
    for (const dep of f.needs) formulae.get(dep)?.dependents.push(f.name)
  }

  const casks: Cask[] = raw.casks.map((c) => ({
    token: c.token,
    desc: c.desc ?? '',
    version: c.installed ?? '',
    tap: c.tap,
    outdated: c.outdated,
    installedAt: c.installed_time,
    deps: resolve(c.depends_on?.formula ?? []),
  }))

  // Roots are what you asked for: formulae installed on request and casks
  const rootDeps = new Map<string, Set<string>>()
  for (const f of formulae.values()) {
    if (f.onRequest) rootDeps.set(f.name, closure([f.name], formulae))
  }
  for (const c of casks) {
    if (c.deps.length > 0) {
      rootDeps.set(c.token, closure(c.deps, formulae).union(new Set(c.deps)))
    }
  }

  const usedBy = new Map<string, string[]>()
  for (const [root, deps] of rootDeps) {
    for (const dep of deps) {
      const list = usedBy.get(dep) ?? []
      list.push(root)
      usedBy.set(dep, list)
    }
  }

  const roots: RootSummary[] = []
  for (const f of formulae.values()) {
    if (!f.onRequest) continue
    const deps = [...rootDeps.get(f.name)!]
    // A dependency is exclusive when no other root needs it and it was not
    // installed on request itself (brew keeps those on autoremove)
    const isExclusive = (dep: string) =>
      !formulae.get(dep)!.onRequest &&
      usedBy.get(dep)!.every((root) => root === f.name)
    const exclusive = deps.filter(isExclusive).sort()
    const shared = deps.filter((d) => !isExclusive(d)).sort()
    roots.push({
      name: f.name,
      exclusive,
      shared,
      totalKb:
        f.sizeKb +
        exclusive.reduce((sum, d) => sum + formulae.get(d)!.sizeKb, 0),
      neededBy: (usedBy.get(f.name) ?? []).filter((r) => r !== f.name).sort(),
    })
  }

  const orphans = [...formulae.values()]
    .filter((f) => !f.onRequest && !usedBy.has(f.name))
    .map((f) => f.name)
    .sort()

  return { formulae, casks, roots, orphans, usedBy }
}
