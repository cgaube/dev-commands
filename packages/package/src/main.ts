import { devCliProgram } from '#common/devCliProgram'
import { log, cancel, outro } from '@clack/prompts'
import { colorize, introTitle } from '#common/style'

import { getFormulas } from './formulas'
import {
  taskLogCommand,
  spinnerCallback,
  outroOrCancel,
  execaCallback,
} from '#common/commands'

const tap = 'cgaube/devcommands'

const pkg = devCliProgram({
  name: 'package',
  summary: 'Manage devcommands packages',
})

pkg
  .command('install <package>')
  .alias('add')
  .description(`Install a package from the ${tap} tap`)
  .action(async (packageName: string) => {
    introTitle('Install Package')

    // Update brew first
    await execaCallback('brew', ['update'])

    const success = await taskLogCommand('brew', [
      'reinstall',
      `${tap}/devcommand-${packageName}`,
    ])

    outroOrCancel(
      success,
      colorize`Package '${packageName}' installed successfully. Usage: {green dev ${packageName}}`,
    )
  })

pkg
  .command('uninstall <package>')
  .alias('remove')
  .description('Uninstall a package from the cgaube/devcommands tap')
  .action(async (packageName: string) => {
    introTitle('Uninstall Package')

    const success = await taskLogCommand('brew', [
      'uninstall',
      `${tap}/devcommand-${packageName}`,
    ])

    outroOrCancel(
      success,
      colorize`Package '${packageName}' uninstalled successfully.`,
    )
  })

pkg
  .command('list')
  .description('List all available packages from the cgaube/devcommands tap')
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

pkg.parse()
