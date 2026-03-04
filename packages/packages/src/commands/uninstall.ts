import { Command } from 'commander'
import { colorize, introTitle } from '#common/style'
import { tapName } from '#src/constants'
import { taskLogCommand, outroOrCancel } from '#common/commands'

export function createUninstallCommand() {
  return new Command('uninstall <package>')
    .alias('remove')
    .description(`uninstall a package from the ${tapName} tap`)
    .action(async (packageName: string) => {
      introTitle('Uninstall Package')

      const success = await taskLogCommand('brew', [
        'uninstall',
        `${tapName}/devcommand-${packageName}`,
      ])

      outroOrCancel(
        success,
        colorize`Package '${packageName}' uninstalled successfully.`,
      )
    })
}
