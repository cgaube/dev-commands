import { Command } from 'commander'
import { colorize, introTitle } from '#common/style'
import { tapName } from '#src/constants'
import {
  execaCallback,
  taskLogCommand,
  outroOrCancel,
  spinnerCallback,
} from '#common/commands'
import { getFormulas } from '#src/utils/formulas'

export function createUpdateCommand() {
  return new Command('update')
    .argument('[package]', 'specific package to update')
    .alias('upgrade')
    .description(`update packages from the ${tapName} tap`)
    .action(async (packageName?: string) => {
      introTitle('Update Packages')

      // Update brew tap metadata
      await execaCallback('brew', ['update'])

      if (packageName) {
        // Update a specific package
        const success = await taskLogCommand('brew', [
          'upgrade',
          `${tapName}/devcommand-${packageName}`,
        ])

        outroOrCancel(
          success,
          colorize`Package '${packageName}' updated successfully.`,
        )
      } else {
        // Find all installed devcommand formulas and upgrade them
        const formulas = await spinnerCallback(getFormulas, {
          startMessage: 'Fetching installed formulas',
        })

        const installed = formulas
          ? Array.from(formulas.entries())
              .filter(([, config]) => config.installed)
              .map(([name]) => `${tapName}/${name}`)
          : []

        if (installed.length === 0) {
          outroOrCancel(true, 'No installed packages to update.')
          return
        }

        const success = await taskLogCommand('brew', ['upgrade', ...installed])

        outroOrCancel(success, 'All packages updated successfully.')
      }
    })
}
