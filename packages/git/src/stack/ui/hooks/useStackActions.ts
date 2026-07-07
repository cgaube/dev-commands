import { useMemo } from 'react'
import { execa } from 'execa'
import { restack } from '#src/stack/restack'
import { sync } from '#src/stack/sync'
import { track, rename, untrack } from '#src/stack/model'

type Run = (label: string, fn: () => Promise<string>) => Promise<void>

// The catalog of git operations, each built on the `run` loop from
// useStackData (which handles busy/status/reload). Pure definitions — no state
// of its own — so it's just a memoized bag of handlers keyed on `run`/`trunk`.
export function useStackActions(run: Run, trunk: string) {
  return useMemo(
    () => ({
      checkout: (name: string) =>
        run(`checking out ${name}…`, async () => {
          await execa('git', ['checkout', name])
          return `on ${name}`
        }),

      openPr: (name: string) =>
        run(`opening PR for ${name}…`, async () => {
          try {
            await execa('gh', ['pr', 'view', name, '--web'])
            return `opened PR for ${name}`
          } catch {
            return `no PR found for ${name}`
          }
        }),

      push: (name: string) =>
        run(`pushing ${name}…`, async () => {
          await execa('git', [
            'push',
            '--force-with-lease',
            '-u',
            'origin',
            name,
          ])
          return `pushed ${name}`
        }),

      createPr: (name: string, parent: string) =>
        run(`creating PR for ${name}…`, async () => {
          await execa('git', [
            'push',
            '--force-with-lease',
            '-u',
            'origin',
            name,
          ])
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
        }),

      restack: () =>
        run('restacking…', async () => {
          const r = await restack()
          if (r.conflict) {
            return `conflict on ${r.conflict.branch} — resolve, run \`git rebase --continue\`, then restack again`
          }
          return r.restacked.length
            ? `restacked ${r.restacked.join(', ')}`
            : 'already up to date'
        }),

      sync: () =>
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
        }),

      create: (name: string, parent: string) =>
        run(`creating ${name}…`, async () => {
          await execa('git', ['checkout', '-b', name, parent])
          await track(name, parent)
          return `created ${name} on ${parent}`
        }),

      rename: (oldName: string, newName: string) =>
        run(`renaming ${oldName}…`, async () => {
          await execa('git', ['branch', '-m', oldName, newName])
          await rename(oldName, newName)
          return `renamed ${oldName} → ${newName}`
        }),

      untrack: (name: string) =>
        run(`untracking ${name}…`, async () => {
          await untrack(name)
          return `untracked ${name}`
        }),
    }),
    [run, trunk],
  )
}
