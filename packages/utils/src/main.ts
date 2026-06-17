import { devCliProgram } from '#common/devCliProgram'
import { commands } from '#src/commands'

const utils = devCliProgram({
  name: 'utils',
  summary: 'A collection of useful utility commands',
})

for (const createCommand of commands) {
  utils.addCommand(createCommand())
}

utils.parse()
