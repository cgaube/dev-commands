import { Command } from 'commander'
import { colorize, introTitle } from '#common/style'
import { tapName } from '#src/constants'
import { taskLogCommand, outroOrCancel, execaCallback } from '#common/commands'

export function createInstallCommand() {
  return new Command('install')
    .argument('<package>', 'package to install')
    .alias('add')
    .description(`install a package from the ${tapName} tap`)
    .action(async (packageName: string) => {
      introTitle('Install Package')

      // Update brew first
      await execaCallback('brew', ['update'])

      const success = await taskLogCommand('brew', [
        'reinstall',
        `${tapName}/devcommand-${packageName}`,
      ])

      outroOrCancel(
        success,
        colorize`Package '${packageName}' installed successfully. Usage: {green dev ${packageName}}`,
      )
    })
}
