import { devCliProgram } from '#common/devCliProgram'
import {
  createListCommand,
  createInstallCommand,
  createUninstallCommand,
  createCreateCommand,
} from '#src/commands'

const pkg = devCliProgram({
  name: 'package',
  summary: 'Manage devcommands packages',
})

pkg.addCommand(createInstallCommand())
pkg.addCommand(createUninstallCommand())
pkg.addCommand(createListCommand())
pkg.addCommand(createCreateCommand())

pkg.parse()
