import { Command } from 'commander'
import { outro, isCancel } from '@clack/prompts'
import { introTitle, picocolors } from '#common/style'
import { taskLogCommand } from '#common/commands'
import { branchesChoices, getCurrentBranch } from '#src/utils/branches'
import { renderStackApp } from '#src/stack/ui/render'
import { buildForest, flatten } from '#src/stack/graph'
import { track, rename, untrack } from '#src/stack/model'
import { restack } from '#src/stack/restack'
import { sync } from '#src/stack/sync'

// `stack create <name>` — branch off the current branch and record the parent
// in one step, so new work is tracked from the moment it exists.
function createCreateCommand() {
  return new Command('create')
    .argument('<name>', 'name of the new branch')
    .description('create a branch stacked on the current one')
    .action(async (name: string) => {
      introTitle('Stack create')
      const parent = getCurrentBranch()
      await taskLogCommand('git', ['checkout', '-b', name])
      await track(name, parent)
      outro(`Created ${name} stacked on ${parent}`)
    })
}

// `stack track` (alias adopt) — retro-fit a parent onto the current branch.
function createTrackCommand() {
  return new Command('track')
    .alias('adopt')
    .description('record a parent for the current branch')
    .action(async () => {
      introTitle('Stack track')
      const current = getCurrentBranch()
      const parent = await branchesChoices()
      if (isCancel(parent)) return outro('Cancelled')
      await track(current, parent)
      outro(`Tracking ${current} on ${parent}`)
    })
}

function createRestackCommand() {
  return new Command('restack')
    .description('rebase the stack onto its parents')
    .action(async () => {
      introTitle('Stack restack')
      const result = await restack()
      if (result.conflict) {
        return outro(
          picocolors.red(
            `Conflict on ${result.conflict.branch}. Resolve, run \`git rebase --continue\`, then re-run restack.`,
          ),
        )
      }
      outro(
        result.restacked.length
          ? `Restacked ${result.restacked.join(', ')}`
          : 'Already up to date',
      )
    })
}

function createSyncCommand() {
  return new Command('sync')
    .description('reparent merged branches and restack')
    .action(async () => {
      introTitle('Stack sync')
      const result = await sync()
      if (result.merged.length) {
        // Merged branches' changes are already in trunk; drop the local refs.
        const { meta } = await buildForest()
        await taskLogCommand('git', ['checkout', meta.trunk])
        for (const branch of result.merged) {
          await taskLogCommand('git', ['branch', '-D', branch])
        }
      }
      if (result.restack.conflict) {
        return outro(
          picocolors.red(
            `Synced, but conflict on ${result.restack.conflict.branch}. Resolve then restack.`,
          ),
        )
      }
      outro(
        result.merged.length
          ? `Synced — removed ${result.merged.join(', ')}`
          : 'Nothing merged to sync',
      )
    })
}

function createRenameCommand() {
  return new Command('rename')
    .argument('<old>', 'current branch name')
    .argument('<new>', 'new branch name')
    .description('rename a tracked branch')
    .action(async (oldName: string, newName: string) => {
      introTitle('Stack rename')
      await taskLogCommand('git', ['branch', '-m', oldName, newName])
      await rename(oldName, newName)
      outro(`Renamed ${oldName} → ${newName}`)
    })
}

// `stack untrack` (alias unfollow) — remove a branch from the stack without
// deleting it. Children are re-parented to the untracked branch's parent.
function createUntrackCommand() {
  return new Command('untrack')
    .alias('unfollow')
    .argument('[branch]', 'branch to untrack (defaults to current)')
    .description('stop tracking a branch in the stack')
    .action(async (branch?: string) => {
      introTitle('Stack untrack')
      const target = branch ?? getCurrentBranch()
      await untrack(target)
      outro(`Untracked ${target}`)
    })
}

// `stack log` — print the tree non-interactively (scriptable, no TUI).
function createLogCommand() {
  return new Command('log')
    .description('print the stack tree')
    .action(async () => {
      const { root } = await buildForest()
      for (const { node, depth } of flatten(root)) {
        const indent = '  '.repeat(depth)
        const marker = node.isCurrent ? picocolors.green('●') : '○'
        const counts = node.ahead ? picocolors.green(`+${node.ahead}`) : ''
        const tags = [
          node.isCurrent ? picocolors.cyan('[current]') : '',
          !node.exists ? picocolors.red('[gone]') : '',
        ]
          .filter(Boolean)
          .join(' ')
        const name = node.isTrunk ? picocolors.dim(node.name) : node.name
        console.log(`${indent}${marker} ${name} ${counts} ${tags}`.trimEnd())
      }
    })
}

export function createStackCommand() {
  const stack = new Command('stack')
    .description('navigate and manage stacked branches')
    .action(async () => {
      await renderStackApp()
    })

  stack.addCommand(createCreateCommand())
  stack.addCommand(createTrackCommand())
  stack.addCommand(createRenameCommand())
  stack.addCommand(createUntrackCommand())
  stack.addCommand(createRestackCommand())
  stack.addCommand(createSyncCommand())
  stack.addCommand(createLogCommand())

  return stack
}
