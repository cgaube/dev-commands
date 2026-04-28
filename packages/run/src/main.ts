import { Command } from 'commander'
import { summary as summaryCommand } from '#common/exosqueleton/summary'
import { runScript } from '#src/lib/runScript'
import { listScripts } from '#src/lib/listScripts'
import type { SourceId } from '#src/sources'

const program = new Command()

program
  .name('run')
  .summary('run a project script from any package manager')
  .description('run a project script (auto-detects manager)')
  .argument('[name]', 'script name (or source:name)')
  .argument('[scriptArgs...]', 'arguments forwarded to the script')
  .option('--summary', 'display a summary of the command')
  .option('-l, --list', 'list discovered scripts instead of running one')
  .option('--source <id>', 'limit to a specific source (bun, make, just, ...)')
  .option('--json', 'output as JSON (with --list)')
  .allowUnknownOption(true)
  .action(
    async (
      name: string | undefined,
      scriptArgs: string[],
      options: {
        summary?: boolean
        complete?: boolean
        list?: boolean
        source?: SourceId
        json?: boolean
      },
    ) => {
      if (options.summary) return summaryCommand(program)
      if (options.list) {
        return listScripts({ source: options.source, json: options.json })
      }
      await runScript(name, scriptArgs, { source: options.source })
    },
  )

program.parse()
