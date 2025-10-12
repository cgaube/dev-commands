import { devCliProgram } from '#common/devCliProgram'
import { branchesChoices } from './utils/branches'
import { cancel, isCancel, spinner, select } from '@clack/prompts'
import { color, introTitle } from '#common/style'
import { executeCommand, getJsonFromCommand } from '#common/commands'

const git = devCliProgram({
  name: 'git',
  summary: 'Git related dev commands',
})

// Sub commands
git
  .command('checkout')
  .alias('switch')
  .description('Better checkout experience')
  .action(async () => {
    introTitle('Git Checkout')

    const branch = await branchesChoices()
    if (isCancel(branch)) {
      return cancel('Operation cancelled.')
    }

    await executeCommand('git', ['checkout', branch], {
      lastCommand: true,
    })
  })

git
  .command('pr')
  .description('Checkout a PR branch')
  .action(async () => {
    introTitle('Git Checkout from PR branch')

    // Fetch all PR info
    const s = spinner()
    s.start('Fetching all PR via gh')
    const prList = await getJsonFromCommand('gh', [
      'pr',
      'list',
      '--json=id,title,author,headRefName',
    ])

    if (prList.length == 0) {
      s.stop(undefined)
      return cancel('Could not fetch any PR for this repository')
    }

    s.stop('PR list correctly fetched')

    const choices = prList.map((pr: any) => {
      return {
        label: `${color.blue(pr.author.login)} -> ${pr.title}`,
        value: pr.headRefName,
      }
    })

    const choice = await select<string>({
      message: 'Select a branch',
      options: choices,
    })

    if (isCancel(choice)) {
      return cancel('Operation cancelled.')
    }

    await executeCommand('git', ['checkout', choice], {
      lastCommand: true,
    })
  })

git
  .command('cleanup')
  .description('Select branch to delete')
  .action(async () => {
    introTitle('Delete branches')

    const selectedBranches = await branchesChoices(true)
    if (isCancel(selectedBranches)) {
      return cancel('Operation cancelled.')
    }

    await executeCommand('git', ['branch', '-D', ...selectedBranches], {
      lastCommand: true,
    })
  })

git.parse()
