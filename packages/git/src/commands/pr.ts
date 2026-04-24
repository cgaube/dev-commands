import { Command } from 'commander'
import { outro, cancel, isCancel, select } from '@clack/prompts'
import { colors, introTitle } from '#common/style'
import { taskLogCommand, execaCallback } from '#common/commands'

export function createPrCommand() {
  return new Command('pr')
    .description('checkout a branch from a pull request')
    .action(async () => {
      introTitle('Git Checkout from PR branch')

      const prListOutput = await execaCallback(
        'gh',
        ['pr', 'list', '--json=id,title,author,headRefName'],
        {
          startMessage: 'Fetching all PR via gh',
          successMessage: 'PR list correctly fetched',
        },
      )
      const pullRequests = prListOutput.toJson()

      if (pullRequests.length == 0) {
        return cancel('Could not fetch any PR for this repository')
      }

      const choices = pullRequests.map((pr: any) => {
        return {
          label: `${colors.blue(pr.author.login)} -> ${pr.title}`,
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
}
