import { devCliProgram } from '#common/devCliProgram'
import { log, outro } from '@clack/prompts'
import { introTitle } from '#common/style'
import { execa } from 'execa'
import { Duration } from 'luxon'
import readline from 'readline'
import {
  isOrbStyle,
  ORB_STYLES,
  OrbAnimation,
  pickRandomOrbStyle,
  type OrbStyle,
} from './animation/orb-animation'

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
  .option(
    '--animation-style <style>',
    `Animation style: ${ORB_STYLES.join(', ')} (default: random)`,
  )
  .option('--no-animation', 'Do not show animated orb', true)
  .action(async (options) => {
    const useAnimation = options.animation === true
    let terminalActive = false
    const animationTimeoutSeconds = Number(options.animationTimeout)
    const shouldAutoStopAnimation =
      Number.isFinite(animationTimeoutSeconds) && animationTimeoutSeconds > 0
    const selectedStyle = options.animationStyle
      ? String(options.animationStyle).trim()
      : ''
    const hasSelectedStyle = selectedStyle.length > 0
    const animationStyle: OrbStyle = hasSelectedStyle
      ? isOrbStyle(selectedStyle)
        ? selectedStyle
        : pickRandomOrbStyle()
      : pickRandomOrbStyle()

    if (hasSelectedStyle && !isOrbStyle(selectedStyle)) {
      log.warning(
        `Unknown animation style "${selectedStyle}". Using random style.`,
      )
    }

    if (useAnimation) {
      process.stdout.write('\x1b[?1049h')
      process.stdout.write('\x1b[?2026h')
      process.stdout.write('\x1b[2J\x1b[0;0H')
      process.stdout.write('\x1b[?25l')
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.on('data', (data) => {
          if (data[0] === 3) process.emit('SIGINT', 'SIGINT')
        })
      }
      terminalActive = true
    }

    const duration = Duration.fromObject({ seconds: options.time }).shiftTo(
      'days',
      'hours',
    )

    const start = Date.now()
    const orb = useAnimation ? new OrbAnimation(animationStyle) : null
    let animationStopTimer: ReturnType<typeof setTimeout> | null = null

    const cleanupTerminal = () => {
      if (!terminalActive) return
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
        process.stdin.pause()
      }
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\x1b[?2026l')
      process.stdout.write('\x1b[?1049l')
      process.stdout.write('\x1b[0;0H')
      terminalActive = false
    }

    const statusLines = [
      '\x1b[1;32m STAY AWAKE\x1b[0m',
      '\x1b[1;32m ================\x1b[0m',
      ` Duration: ${duration.toHuman()}`,
    ]
    if (useAnimation) {
      statusLines.push(` Style: ${animationStyle}`)
    }
    statusLines.push('\x1b[2m Press Ctrl+C to cancel\x1b[0m')

    const renderAnimatedScreen = (orbFrame: string) => {
      const rows = process.stdout.rows || 24
      const orbLines = orbFrame.split('\n')
      const orbHeight = orbLines.length
      const usableRows = Math.max(1, rows)
      const screenLines = Array.from({ length: usableRows }, () => '')

      const topPadding = Math.max(
        0,
        Math.floor((usableRows - orbHeight) / 2) - 2,
      )
      for (let i = 0; i < orbHeight; i++) {
        const lineIndex = topPadding + i
        if (lineIndex < usableRows) {
          screenLines[lineIndex] = orbLines[i]
        }
      }

      const maxStatusStart = Math.max(0, usableRows - statusLines.length)
      const statusStart = maxStatusStart
      for (let i = 0; i < statusLines.length; i++) {
        const lineIndex = statusStart + i
        if (lineIndex < usableRows) {
          screenLines[lineIndex] = statusLines[i]
        }
      }

      process.stdout.write(
        '\x1b[H' + screenLines.map((l) => l + '\x1b[K').join('\n') + '\x1b[J',
      )
    }

    if (!useAnimation) {
      process.stdout.write('\x1b[0;0H\x1b[J' + statusLines.join('\n'))
    } else {
      orb!.start(() => {
        renderAnimatedScreen(orb!.getFrame())
      })

      if (shouldAutoStopAnimation) {
        animationStopTimer = setTimeout(() => {
          orb!.stop()
        }, animationTimeoutSeconds * 1000)
      }
    }

    const resizeHandler = () => {
      if (terminalActive) {
        process.stdout.write('\x1b[2J\x1b[H')
      }
    }
    if (useAnimation) {
      process.on('SIGWINCH', resizeHandler)
    }

    const caffeinate = execa('caffeinate', ['-disu', '-t', options.time], {
      stdio: 'inherit',
    })

    const sigintHandler = () => {
      process.off('SIGWINCH', resizeHandler)
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
      process.off('SIGWINCH', resizeHandler)
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
