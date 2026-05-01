import { Command } from 'commander'
import { log, outro } from '@clack/prompts'
import { spinnerCallback } from '#common/commands'
import { colorize, introTitle } from '#common/style'
import { exitIfInvalid } from '#src/config'
import { getCurrentUser } from '#src/provider'

export function createWhoamiCommand() {
  return new Command('whoami')
    .description('show the currently authenticated jira user')
    .action(async () => {
      introTitle('Current Jira user')
      await exitIfInvalid()

      const { user, host } = await spinnerCallback(() => getCurrentUser(), {
        startMessage: 'Fetching current user',
        successMessage: 'Fetched current user',
      })

      const lines = [
        colorize`{bold.blue ${user.displayName ?? '(no name)'}}`,
        colorize`{dim email:}      ${user.emailAddress ?? '(hidden)'}`,
        colorize`{dim accountId:}  ${user.accountId ?? '(unknown)'}`,
        colorize`{dim active:}     ${user.active ? 'yes' : 'no'}`,
        colorize`{dim host:}       ${host}`,
      ]

      log.message(lines.join('\n'))
      outro()
    })
}
