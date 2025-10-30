import { devCliProgram } from '#common/devCliProgram'
import { branchesChoices } from './utils/branches'
import { outro, cancel, isCancel, select } from '@clack/prompts'
import { color, introTitle } from '#common/style'
import { taskLogCommand, execaCallback } from '#common/commands'

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

    await taskLogCommand('git', ['checkout', branch])
    outro()
  })

git
  .command('pr')
  .description('Checkout a PR branch')
  .action(async () => {
    introTitle('Git Checkout from PR branch')

    // Fetch all PR info
    const prList = await execaCallback(
      'gh',
      ['pr', 'list', '--json=id,title,author,headRefName'],
      {
        startMessage: 'Fetching all PR via gh',
        stopMessage: 'PR list correctly fetched',
      },
    ).toJson()

    if (prList.length == 0) {
      return cancel('Could not fetch any PR for this repository')
    }

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

    await taskLogCommand('git', ['checkout', choice])
    outro()
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

    await taskLogCommand('git', ['branch', '-D', ...selectedBranches])
    outro()
  })

git.parse()
