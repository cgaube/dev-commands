import { devCliProgram } from '#common/devCliProgram'
import { injectConfigCommands } from '#src/config'
import { commands } from '#src/commands'

const linear = devCliProgram({
  name: 'linear',
  summary: 'Linear related dev commands',
})

injectConfigCommands(linear)
for (const createCommand of commands) {
  linear.addCommand(createCommand())
}

linear.parse()
