import { devCliProgram } from '#common/devCliProgram'
import { commands } from '#src/commands'

const git = devCliProgram({
  name: 'git',
  summary: 'Git related dev commands',
})

for (const createCommand of commands) {
  git.addCommand(createCommand())
}

git.parse()
