import { Command } from 'commander'
import { picocolors } from '#common/style'
import { loadStackState } from '#src/stack/model'
import { toRows } from '#src/ui/rows'

// `log`: print the tree of stacks without the TUI, so that scripts can use it.
export function createLogCommand() {
  return new Command('log')
    .description('print the tree of local stacks')
    .action(async () => {
      const state = await loadStackState()
      if (!state.stacks.length) {
        console.log(picocolors.dim('no stacks — run gh stack init <branch>'))
        return
      }
      for (const row of toRows(state)) {
        const { branch, stack } = row
        const indent = '  '.repeat(row.depth)
        const marker = row.isCurrent
          ? picocolors.green('●')
          : branch
            ? '○'
            : '⌂'
        const tags = branch
          ? [
              row.isStackStart && stack?.number
                ? picocolors.dim(`stack #${stack.number}`)
                : '',
              branch.ahead ? picocolors.green(`+${branch.ahead}`) : '',
              branch.prNumber ? picocolors.dim(`PR #${branch.prNumber}`) : '',
              branch.isMerged ? picocolors.magenta('[merged]') : '',
              branch.needsRebase ? picocolors.yellow('[needs rebase]') : '',
              !branch.exists && !branch.isMerged
                ? picocolors.red('[gone]')
                : '',
            ]
          : []
        if (row.isCurrent) tags.push(picocolors.cyan('[current]'))
        console.log(
          `${indent}${marker} ${row.name} ${tags.filter(Boolean).join(' ')}`.trimEnd(),
        )
      }
    })
}
