import { Command } from 'commander'
import { cancel, log, outro } from '@clack/prompts'
import { spinnerCallback } from '#common/commands'
import { introTitle } from '#common/style'
import { exitIfInvalid } from '#src/config'
import {
  formatAssignedIssue,
  getAssignedIssues,
  withAssignedIssueFilters,
} from '#src/utils/issues'

export function createListCommand() {
  return withAssignedIssueFilters(
    new Command('list')
      .alias('me')
      .description('list assigned linear issues')
      .action(async (opts) => {
        introTitle('Assigned issues')
        await exitIfInvalid()

        const issues = await spinnerCallback(() => getAssignedIssues(opts), {
          startMessage: 'Fetching assigned issues',
          successMessage: `Fetched assigned issues matching filters ${JSON.stringify(opts)}`,
        })

        if (!issues?.length) {
          return cancel('No assigned issues match these filters.')
        }

        const output = await Promise.all(issues.map(formatAssignedIssue))
        log.message(output.join('\n\n'))
        outro()
      }),
  )
}
