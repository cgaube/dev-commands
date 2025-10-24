import { devCliProgram } from '#common/devCliProgram'
import { log, intro, outro } from '@clack/prompts'
import { introTitle, colorize } from '#common/style'
import { execa } from 'execa'
import figlet from 'figlet'
import readline from 'readline'
import { Duration } from 'luxon'
import font from './Colossal.flf' with { type: 'text' }

const utils = devCliProgram({
  name: 'utils',
  summary: 'A collection of useful utility commands',
})

utils
  .command('stay-awake')
  .description('Prevents the system from sleeping for a specified duration')
  .option(
    '-t, --time <seconds>',
    'The duration in seconds to stay awake',
    '2628000',
  )
  .action(async (options) => {
    process.stdout.write('\x1b[2J\x1b[0;0H')
    intro()

    figlet.parseFont('Default', font)
    log.message(figlet.textSync('  Stay Awake  ', { font: 'Default' }))

    const duration = Duration.fromObject({ seconds: options.time }).shiftTo(
      'days',
      'hours',
    )
    log.info(
      colorize`Duration: ${duration.toHuman()}. {dim Press Ctrl+C to cancel}`,
    )
    const start = Date.now()

    const caffeinate = execa('caffeinate', ['-u', '-t', options.time], {
      stdio: 'inherit',
    })

    // Capture Ctrl-C in parent process
    process.on('SIGINT', () => {
      // Get rid of the ^C
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)

      const elapsedSeconds = Math.floor((Date.now() - start) / 1000)
      const awakeFor = Duration.fromObject({ seconds: elapsedSeconds })
      log.info(`Was awake for ${awakeFor.toHuman({ unitDisplay: 'short' })}`)
      outro('Go to bed! 😴')
      caffeinate.kill('SIGINT')
      process.exit(0)
    })
    await caffeinate
  })

utils
  .command('port')
  .description('Lists applications listening on a specific port')
  .argument('<port>', 'The port number to listen on')
  .action(async (port) => {
    introTitle('Port Listeners')

    try {
      const { stdout } = await execa('lsof', ['-i', `:${port}`])
      log.info(stdout as string)
    } catch {
      log.warning('No processes are listening on this port.')
    }
    outro()
  })

utils.parse()
