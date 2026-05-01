import { Command } from 'commander'
import { log, outro } from '@clack/prompts'
import { spinnerCallback } from '#common/commands'
import { colorize, introTitle } from '#common/style'
import { exitIfInvalid } from '#src/config'
import { getCurrentUser } from '#src/provider'

export function createWhoamiCommand() {
  return new Command('whoami')
    .description('show the currently authenticated linear user')
    .action(async () => {
      introTitle('Current Linear user')
      await exitIfInvalid()

      const user = await spinnerCallback(() => getCurrentUser(), {
        startMessage: 'Fetching current user',
        successMessage: 'Fetched current user',
      })

      const lines = [
        colorize`{bold.blue ${user.displayName || user.name || '(no name)'}}`,
        colorize`{dim email:}   ${user.email ?? '(hidden)'}`,
        colorize`{dim id:}      ${user.id}`,
        colorize`{dim active:}  ${user.active ? 'yes' : 'no'}`,
        colorize`{dim url:}     ${user.url}`,
      ]

      log.message(lines.join('\n'))
      outro()
    })
}
