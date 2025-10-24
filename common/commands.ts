import { cancel, log, spinner } from '@clack/prompts'
import { execa } from 'execa'
import { colorize } from './style'

type DisplayOptions = {
  lastCommand?: boolean // Whether this is the last commmand of cli (we will display outro)
  displayCommandResult?: boolean
  displayError?: boolean
}

const executeCommand = async (
  command: string,
  args: string[],
  options?: DisplayOptions,
) => {
  const displayOptions = {
    displayCommandResult: true,
    displayError: true,
    ...options,
  }
  const logCommand = `${command} ${args.join(' ')}`

  const s = spinner()

  const startMessage = colorize`{blue Executing:} {dim ${logCommand}}`
  s.start(startMessage)

  try {
    const { stdout } = await execa(command, args)

    const successMessage = colorize`{success Success:} {dim ${logCommand}}`
    s.stop(successMessage, 0)

    if (displayOptions.displayCommandResult) {
      log.info(stdout as string)
    }
  } catch (error: any) {
    const errorMessage = colorize`{error Error:} {dim ${logCommand}}`
    s.stop(errorMessage, 1)

    if (displayOptions.displayError) {
      const errorMessage = error.stderr || error.message
      log.message(errorMessage)
    }
  }

  if (displayOptions.lastCommand) {
    cancel()
  }
}

const getJsonFromCommand = async (command: string, args: string[]) => {
  const { stdout } = await execa(command, args)
  return JSON.parse(stdout.toString().trim())
}

export { executeCommand, getJsonFromCommand }
