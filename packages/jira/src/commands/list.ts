import { Command } from 'commander'
import { cancel, log, outro } from '@clack/prompts'
import { spinnerCallback } from '#common/commands'
import { introTitle } from '#common/style'
import { exitIfInvalid } from '#src/config'
import { getAssignedIssues } from '#src/provider'
import { formatIssue, withIssueFilters } from '#src/utils/issues'

export function createListCommand() {
  return withIssueFilters(
    new Command('list')
      .alias('me')
      .description('list assigned jira issues')
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

        log.message(issues.map(formatIssue).join('\n\n'))
        outro()
      }),
  )
}
