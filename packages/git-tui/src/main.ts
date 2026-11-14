import { devCliProgram } from '#common/devCliProgram'
import { autoComplete } from '#common/exosqueleton/autoComplete'
import { summary as summaryCommand } from '#common/exosqueleton/summary'
import { exitWithError } from '#common/style'
import { injectConfigCommands } from '#src/config'
import { startTui } from '#src/ui/render'

const program = devCliProgram({
  name: 'git-tui',
  summary: 'view branches, stacks, PRs and CI status',
})

// Stop early with a clear message when a required tool is missing.
function checkTools() {
  if (!Bun.which('git')) exitWithError('git is not installed')
  if (!Bun.which('gh')) {
    exitWithError('gh is not installed. See https://cli.github.com')
  }
}

// Without a subcommand, open the TUI. Keep --summary and --complete.
program.action(async (optionalArgs, options) => {
  if (options.summary) return summaryCommand(program)
  if (options.complete) return autoComplete(program, optionalArgs)
  checkTools()
  await startTui()
  process.exit(0)
})

injectConfigCommands(program)

program.parse()
