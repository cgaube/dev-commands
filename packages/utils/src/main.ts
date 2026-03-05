import { devCliProgram } from '#common/devCliProgram'
import { log, outro } from '@clack/prompts'
import { introTitle } from '#common/style'
import { execa } from 'execa'
import { Duration } from 'luxon'
import readline from 'readline'
import { OrbAnimation } from './orb'

const utils = devCliProgram({
  name: 'utils',
  summary: 'A collection of useful utility commands',
})

utils
  .command('stay-awake')
  .description('prevents the system from sleeping for a specified duration')
  .option(
    '-t, --time <seconds>',
    'The duration in seconds to stay awake',
    '2628000',
  )
  .option('--no-animation', 'Do not show animated orb', true)
  .action(async (options) => {
    const useAnimation = options.animation === true

    if (useAnimation) {
      process.stdout.write('\x1b[?1049h')
      process.stdout.write('\x1b[?2026h')
      process.stdout.write('\x1b[2J\x1b[0;0H')
      process.stdout.write('\x1b[?25l')
    }

    const duration = Duration.fromObject({ seconds: options.time }).shiftTo(
      'days',
      'hours',
    )

    const start = Date.now()
    const orb = useAnimation ? new OrbAnimation() : null
    const { rows } = process.stdout

    let stayAwakeDescription = '\n\n\n'
    stayAwakeDescription += '\x1b[1;32m'
    stayAwakeDescription += ' STAY AWAKE\n'
    stayAwakeDescription += ' ================\n'
    stayAwakeDescription += '\x1b[0m'
    stayAwakeDescription += ` Duration: ${duration.toHuman()}\n\n`
    stayAwakeDescription += `\x1b[2m Press Ctrl+C to cancel\x1b[0m`

    if (!useAnimation) {
      let output = '\x1b[0;0H\x1b[J'
      output += stayAwakeDescription

      process.stdout.write(output)
    } else {
      orb!.start(() => {
        const elapsed = Date.now() - start
        // Automatically stop after 1 minute
        if (elapsed > 60000) {
          orb!.stop()
        }

        const orbFrame = orb!.getFrame()
        const orbLines = orbFrame.split('\n')
        const orbHeight = orbLines.length

        const topPadding = Math.floor((rows - orbHeight) / 2) - 2

        let output = '\x1b[0;0H\x1b[J'
        for (let i = 0; i < topPadding; i++) {
          output += '\n'
        }
        output += orbLines.join('\n') + '\n'

        const textStartLine = topPadding + orbHeight + 2

        for (let i = textStartLine; i < rows - 3; i++) {
          output += '\n'
        }

        output += '\x1b[1;32m'
        output += stayAwakeDescription

        process.stdout.write(output)
      })
    }

    const caffeinate = execa('caffeinate', ['-disu', '-t', options.time], {
      stdio: 'inherit',
    })

    process.on('SIGINT', () => {
      if (orb) orb.stop()
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[?1049l')
      process.stdout.write('\x1b[0;0H')

      readline.cursorTo(process.stdout, 0)
      readline.clearLine(process.stdout, 0)

      const finalElapsed = Math.floor((Date.now() - Date.now()) / 1000)
      const awakeFor = Duration.fromObject({ seconds: finalElapsed })
      log.info(
        `Was kept awake for ${awakeFor.toHuman({ unitDisplay: 'short' })}`,
      )
      outro('Go to bed! 😴')
      caffeinate.kill('SIGINT')
      process.exit(0)
    })

    try {
      await caffeinate
    } finally {
      if (orb) orb.stop()
      if (useAnimation) process.stdout.write('\x1b[?25h')
    }
  })

utils
  .command('port')
  .description('lists applications listening on a specific port')
  .argument('<port>', 'The port number to listen to')
  .action(async (port) => {
    introTitle('Port Listeners')

    try {
      const { stdout } = await execa('lsof', [
        '-i',
        `:${port}`,
        '-s',
        'TCP:LISTEN',
      ])
      log.info(stdout as string)
    } catch {
      log.warning('No processes are listening on this port.')
    }
    outro()
  })

utils.parse()
