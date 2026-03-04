import { Command } from 'commander'
import { log, cancel, outro } from '@clack/prompts'
import { colorize, introTitle } from '#common/style'
import { getFormulas } from '#src/utils/formulas'
import { spinnerCallback } from '#common/commands'
import { tapName } from '#src/constants'

export function createListCommand() {
  return new Command('list')
    .alias('ls')
    .description(`list all available packages from the ${tapName} tap`)
    .action(async () => {
      introTitle('Available Packages')

      const formulas = await spinnerCallback(getFormulas, {
        startMessage: 'Fetching formulas',
      })

      if (!formulas) {
        return cancel()
      }

      const packageOutput = Array.from(formulas.entries())
        .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
        .map(([path, config]) => {
          const statusIcon = config.installed
            ? colorize`{dim.green \u2714}`
            : colorize`{dim {red \u2716}}`
          const packageName = config.installed ? path : colorize`{dim ${path}}`

          const info = [statusIcon, packageName]
          if (config.desc) {
            info.push(colorize`{dim \uf444 ${config.desc}}`)
          }
          return info.join(' ')
        })

      log.message(packageOutput.join('\n'))
      outro()
    })
}
