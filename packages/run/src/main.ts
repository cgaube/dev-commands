import { devCliProgram } from '#common/devCliProgram'
import { commands } from '#src/commands'

const run = devCliProgram({
  name: 'run',
  summary: 'run a project script from any package manager',
})

for (const createCommand of commands) {
  run.addCommand(createCommand())
}

run.parse()
