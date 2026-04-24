import { devCliProgram } from '#common/devCliProgram'
import {
  createListCommand,
  createInstallCommand,
  createUninstallCommand,
  createCreateCommand,
  createUpdateCommand,
} from '#src/commands'

const pkg = devCliProgram({
  name: 'packages',
  summary: 'Manage devcommands packages',
})

pkg.addCommand(createInstallCommand())
pkg.addCommand(createUninstallCommand())
pkg.addCommand(createListCommand())
pkg.addCommand(createCreateCommand())
pkg.addCommand(createUpdateCommand())

pkg.parse()
