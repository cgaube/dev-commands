import { devCliProgram } from '#common/devCliProgram'
import { injectConfigCommands } from '#src/config'
import { commands } from '#src/commands'

const jira = devCliProgram({
  name: 'jira',
  summary: 'Jira related dev commands',
})

injectConfigCommands(jira)
for (const createCommand of commands) {
  jira.addCommand(createCommand())
}

jira.parse()
