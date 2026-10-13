import { devCliProgram } from '#common/devCliProgram'
import { autoComplete } from '#common/exosqueleton/autoComplete'
import { summary as summaryCommand } from '#common/exosqueleton/summary'
import { colorize, exitWithError, introTitle } from '#common/style'
import { commands } from '#src/commands'
import { checkGhStack, GhStackError } from '#src/stack/ghStack'
import { renderStackApp } from '#src/ui/render'
import { currentBranch } from '#src/utils/git'
import { outro } from '@clack/prompts'

const gitTui = devCliProgram({
  name: 'git-tui',
  summary: 'browse branches and manage stacked PRs',
})

// Without a subcommand, open the TUI. The default action of devCliProgram
// shows the help, so replace it, but keep --summary and --complete.
gitTui.action(async (optionalArgs, options) => {
  if (options.summary) return summaryCommand(gitTui)
  if (options.complete) return autoComplete(gitTui, optionalArgs)

  introTitle('Git TUI')
  try {
    await renderStackApp(await checkGhStack())
  } catch (error) {
    if (error instanceof GhStackError) exitWithError(error.message)
    throw error
  }
  outro(colorize`On {cyan ${await currentBranch()}}`)
})

for (const createCommand of commands) {
  gitTui.addCommand(createCommand())
}

gitTui.parse()
