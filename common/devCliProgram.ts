import { Command } from 'commander'
import { autoComplete } from './exosqueleton/autoComplete'
import { summary as summaryCommand } from './exosqueleton/summary'

type Params = {
  name: string
  summary: string
}

export function devCliProgram({ name, summary }: Params) {
  const program = new Command()
  program
    .name(name)
    .summary(summary)
    .option('--summary', 'Display a summary of the command')
    .option('--complete', 'Output list of shell-completions for <input>')
    .argument('[optionalArgs...]')
    .action((optionalArgs, options) => {
      if (options.summary) {
        return summaryCommand(program)
      }
      if (options.complete) {
        return autoComplete(program, optionalArgs)
      }
    })

  return program
}
