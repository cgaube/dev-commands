import { Command } from 'commander'
import { outro, cancel, isCancel } from '@clack/prompts'
import { introTitle } from '#common/style'
import { taskLogCommand } from '#common/commands'
import { branchesChoices } from '#src/utils/branches'

export function createCheckoutCommand() {
  return new Command('checkout')
    .alias('switch')
    .description('switch to a branch with enhanced UX')
    .action(async () => {
      introTitle('Git Checkout')

      const branch = await branchesChoices()
      if (isCancel(branch)) {
        return cancel('Operation cancelled.')
      }

      await taskLogCommand('git', ['checkout', branch])
      outro()
    })
}
