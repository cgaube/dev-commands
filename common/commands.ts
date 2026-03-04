import { cancel, log, spinner, taskLog, outro } from '@clack/prompts'
import type { SpinnerOptions, TaskLogCompletionOptions } from '@clack/prompts'
import { execa, ExecaError } from 'execa'
import { colors, colorize } from './style'
import { clearLine, moveCursor } from 'readline'
import { CommandOutput } from './utils/commandOutput'

type ExecuteOptions = {
  startMessage?: string
  successMessage?: string
  errorMessage?: string
  outputError?: boolean
  spinnerOptions?: SpinnerOptions
}

const clearLastLines = (n: number) => {
  for (let i = 0; i < n; i++) {
    moveCursor(process.stdout, 0, -1) // move up one line
    clearLine(process.stdout, 0) // clear entire line
  }
}

/**
 * Execute an execa command and return its output
 */
async function execaCallback(
  command: string,
  args: string[],
  options: ExecuteOptions = {},
) {
  const logCommand = `${command} ${args.join(' ')}`
  const startMessage = colorize`{blue Executing:} {dim ${logCommand}}`
  const successMessage = colorize`{green Executed:} {dim ${logCommand}}`

  const callback = async () => {
    const { stdout } = await execa(command, args)
    return new CommandOutput(stdout.toString().trim())
  }

  return spinnerCallback(callback, {
    startMessage,
    successMessage,
    ...options,
  })
}

// Execute command in background to capture output
// stop spinner when done - clear if no success message
async function spinnerCallback<T = any>(
  callback: (() => T) | (() => Promise<T>),
  options: ExecuteOptions = {},
) {
  const {
    startMessage = undefined,
    successMessage = undefined,
    errorMessage = undefined,
    outputError = true,
    spinnerOptions = {},
  } = options

  const s = spinner(spinnerOptions)
  s.start(startMessage)

  try {
    const result = await callback()
    if (successMessage) {
      s.stop(successMessage)
    } else {
      s.stop()
      clearLastLines(2)
    }
    return result
  } catch (error) {
    if (error instanceof ExecaError) {
      const errMessage =
        errorMessage ||
        colorize`{red Command failed:} {dim.red ${error.escapedCommand}}`
      s.error(errMessage)

      if (outputError) {
        log.message(
          colors.dim(
            errorMessage
              ? error.message
              : error.originalMessage || error.stderr,
          ),
        )
      }
    } else {
      throw error
    }
    process.exit(1)
  }
}

/**
 * Display command output
 */
async function taskLogCommand(
  command: string,
  args: string[] = [],
  taskLogCompletionOptions: Partial<TaskLogCompletionOptions> = {},
) {
  const logCommand = `${command} ${args.join(' ')}`
  const title = colorize`{blue Executing:} {dim ${logCommand}}`

  const task = taskLog({ title, retainLog: true, spacing: 1 })
  const completionOptions = { showLog: true, ...taskLogCompletionOptions }

  try {
    const subprocess = execa(command, args)
    subprocess.stdout?.on('data', (chunk) => {
      const striped = stripAnsi(chunk.toString().trim())
      task.message(wrap(striped))
    })
    await subprocess
    task.success(
      colorize`{green Executed:} {dim ${logCommand}}`,
      completionOptions,
    )
    return true
  } catch (error) {
    if (error instanceof ExecaError) {
      task.message(wrap(error.stderr || error.originalMessage))

      const message = colorize`{red Command failed:} {dim.red ${error.escapedCommand}}`
      task.error(message)

      cancel()
      process.exit(1)
    }
  }
}

const regEx = ansiRegex()
function stripAnsi(string: string) {
  return string.replace(regEx, '')
}
function ansiRegex({ onlyFirst = false } = {}) {
  // Valid string terminator sequences are BEL, ESC\, and 0x9c
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)'
  // OSC sequences only: ESC ] ... ST (non-greedy until the first ST)
  const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`
  // CSI and related: ESC/C1, optional intermediates, optional params (supports ; and :) then final byte
  const csi =
    '[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]'

  const pattern = `${osc}|${csi}`

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}
function wrap(text: string): string {
  const width = process.stdout.columns - 3
  return text
    .split('\n') // preserve existing newlines
    .map((line) => {
      if (line.length <= width) return line // leave short lines as-is

      // break long lines
      const chunks: string[] = []
      let start = 0
      while (start < line.length) {
        chunks.push(line.slice(start, start + width))
        start += width
      }
      return chunks.join('\n')
    })
    .join('\n')
}

function outroOrCancel(
  result: boolean | undefined,
  success: string | undefined = undefined,
  errorMessage: string | undefined = undefined,
) {
  if (result) {
    outro(success)
  } else {
    cancel(errorMessage)
  }
}

export { spinnerCallback, execaCallback, taskLogCommand, outroOrCancel }
