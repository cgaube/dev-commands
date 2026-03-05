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
  .option(
    '--animation-timeout <seconds>',
    'How long to animate before freezing the last frame (0 disables timeout)',
    '60',
  )
  .option('--no-animation', 'Do not show animated orb', true)
  .action(async (options) => {
    const useAnimation = options.animation === true
    let terminalActive = false
    const animationTimeoutSeconds = Number(options.animationTimeout)
    const shouldAutoStopAnimation =
      Number.isFinite(animationTimeoutSeconds) && animationTimeoutSeconds > 0

    if (useAnimation) {
      process.stdout.write('\x1b[?1049h')
      process.stdout.write('\x1b[?2026h')
      process.stdout.write('\x1b[2J\x1b[0;0H')
      process.stdout.write('\x1b[?25l')
      terminalActive = true
    }

    const duration = Duration.fromObject({ seconds: options.time }).shiftTo(
      'days',
      'hours',
    )

    const start = Date.now()
    const orb = useAnimation ? new OrbAnimation() : null
    let animationStopTimer: ReturnType<typeof setTimeout> | null = null

    const cleanupTerminal = () => {
      if (!terminalActive) return
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[?2026l')
      process.stdout.write('\x1b[?1049l')
      process.stdout.write('\x1b[0;0H')
      terminalActive = false
    }

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
        const rows = process.stdout.rows || 24

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

      if (shouldAutoStopAnimation) {
        animationStopTimer = setTimeout(() => {
          orb!.stop()
        }, animationTimeoutSeconds * 1000)
      }
    }

    const caffeinate = execa('caffeinate', ['-disu', '-t', options.time], {
      stdio: 'inherit',
    })

    const sigintHandler = () => {
      if (orb) orb.stop()
      cleanupTerminal()

      readline.cursorTo(process.stdout, 0)
      readline.clearLine(process.stdout, 0)

      const finalElapsed = Math.floor((Date.now() - start) / 1000)
      const awakeFor = Duration.fromObject({ seconds: finalElapsed })
      log.info(
        `Was kept awake for ${awakeFor.toHuman({ unitDisplay: 'short' })}`,
      )
      outro('Go to bed! 😴')
      caffeinate.kill('SIGINT')
      process.exit(0)
    }
    process.on('SIGINT', sigintHandler)

    try {
      await caffeinate
    } finally {
      process.off('SIGINT', sigintHandler)
      if (animationStopTimer) clearTimeout(animationStopTimer)
      if (orb) orb.stop()
      cleanupTerminal()
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
