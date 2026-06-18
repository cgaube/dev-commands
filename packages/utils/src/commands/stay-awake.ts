import { Command } from 'commander'
import { log, outro } from '@clack/prompts'
import { execa } from 'execa'
import { Duration } from 'luxon'
import { introTitle } from '#common/style'
import {
  isOrbStyle,
  ORB_STYLES,
  OrbAnimation,
  pickRandomOrbStyle,
  type OrbStyle,
} from '../animation/orb-animation'
import { runFullscreenOrb } from '../animation/orb-screen'

export function createStayAwakeCommand() {
  return new Command('stay-awake')
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
      const animationTimeoutSeconds = Number(options.animationTimeout)
      const animateForever = !(
        Number.isFinite(animationTimeoutSeconds) && animationTimeoutSeconds > 0
      )

      const duration = Duration.fromObject({
        seconds: Number(options.time),
      }).shiftTo('days', 'hours')

      introTitle('Stay Awake')

      // Start keeping the machine awake immediately, including during the
      // animation. `caffeinate` is a built-in macOS tool that does the actual
      // work; everything else here is just presentation.
      const start = Date.now()
      const caffeinate = execa('caffeinate', ['-disu', '-t', options.time], {
        stdio: 'inherit',
      })

      const quit = () => {
        const awakeFor = Duration.fromObject({
          seconds: Math.floor((Date.now() - start) / 1000),
        })
        log.info(
          `Was kept awake for ${awakeFor.toHuman({ unitDisplay: 'short' })}`,
        )
        outro('Go to bed! 😴')
        caffeinate.kill('SIGINT')
        process.exit(0)
      }

      if (useAnimation) {
        const requestedStyle = String(options.animationStyle ?? '').trim()
        if (requestedStyle && !isOrbStyle(requestedStyle)) {
          log.warning(
            `Unknown animation style "${requestedStyle}". Using random style.`,
          )
        }
        const animationStyle: OrbStyle = isOrbStyle(requestedStyle)
          ? requestedStyle
          : pickRandomOrbStyle()

        const statusLines = [
          '\x1b[1;32m STAY AWAKE\x1b[0m',
          '\x1b[1;32m ================\x1b[0m',
          ` Duration: ${duration.toHuman()}`,
          '\x1b[2m Press Ctrl+C to cancel\x1b[0m',
        ]

        // Show the orb fullscreen: animate, then freeze on the last frame and
        // leave it there. The terminal keeps the alternate screen alive (like
        // vim/htop), so we just wait until the user cancels or caffeinate ends.
        const orb = new OrbAnimation(animationStyle)
        const session = runFullscreenOrb(
          orb,
          statusLines,
          animateForever ? Infinity : animationTimeoutSeconds * 1000,
        )
        // Wait until the user cancels or caffeinate's timer elapses. The
        // `.catch` keeps an abnormal caffeinate exit from throwing here so we
        // still fall through to the summary.
        await Promise.race([session.cancelled, caffeinate]).catch(() => {})
        session.close()
      } else {
        // No animation: just show the status and wait for the user to cancel
        // or for caffeinate to finish.
        log.message(`Duration: ${duration.toHuman()}\nPress Ctrl+C to cancel`)

        const isTTY = process.stdin.isTTY
        const onData = (data: Buffer) => {
          if (data[0] === 3) process.emit('SIGINT') // Ctrl+C, without echoing ^C
        }
        const cancelled = new Promise<void>((resolve) => {
          process.once('SIGINT', () => resolve())
          if (isTTY) {
            // Raw mode lets us catch Ctrl+C ourselves instead of the terminal
            // echoing a stray "^C" into the clack output.
            process.stdin.setRawMode(true)
            process.stdin.resume()
            process.stdin.on('data', onData)
          }
        })
        await Promise.race([cancelled, caffeinate]).catch(() => {})

        if (isTTY) {
          process.stdin.off('data', onData)
          process.stdin.setRawMode(false)
          process.stdin.pause()
        }
      }

      quit()
    })
}
