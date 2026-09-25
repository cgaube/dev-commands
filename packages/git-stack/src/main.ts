import { devCliProgram } from '#common/devCliProgram'
import { autoComplete } from '#common/exosqueleton/autoComplete'
import { summary as summaryCommand } from '#common/exosqueleton/summary'
import { colorize, exitWithError, introTitle } from '#common/style'
import { commands } from '#src/commands'
import { checkGhStack, GhStackError } from '#src/stack/ghStack'
import { renderStackApp } from '#src/ui/render'
import { currentBranch } from '#src/utils/git'
import { outro } from '@clack/prompts'

const gitStack = devCliProgram({
  name: 'git-stack',
  summary: 'manage stacked PRs with GitHub gh stack',
})

// Without a subcommand, open the TUI. The default action of devCliProgram
// shows the help, so replace it, but keep --summary and --complete.
gitStack.action(async (optionalArgs, options) => {
  if (options.summary) return summaryCommand(gitStack)
  if (options.complete) return autoComplete(gitStack, optionalArgs)

  introTitle('Git stack')
  try {
    await renderStackApp(await checkGhStack())
  } catch (error) {
    if (error instanceof GhStackError) exitWithError(error.message)
    throw error
  }
  outro(colorize`On {cyan ${await currentBranch()}}`)
})

for (const createCommand of commands) {
  gitStack.addCommand(createCommand())
}

gitStack.parse()
