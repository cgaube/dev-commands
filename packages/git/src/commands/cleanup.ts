import { Command } from 'commander'
import { outro, cancel, isCancel } from '@clack/prompts'
import { introTitle } from '#common/style'
import { taskLogCommand } from '#common/commands'
import { branchesChoices } from '#src/utils/branches'

export function createCleanupCommand() {
  return new Command('cleanup')
    .description('select branches to delete')
    .action(async () => {
      introTitle('Delete branches')

      const selectedBranches = await branchesChoices(true)
      if (isCancel(selectedBranches)) {
        return cancel('Operation cancelled.')
      }

      await taskLogCommand('git', ['branch', '-D', ...selectedBranches])
      outro()
    })
}
