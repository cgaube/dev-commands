import { Command } from 'commander'
import { group, outro, select, spinner, text } from '@clack/prompts'
import v from 'voca'
import { taskLogCommand } from '#common/commands'
import { colorize, exitWithCancel, introTitle } from '#common/style'
import { exitIfInvalid } from '#src/config'
import {
  getAssignedIssues,
  mapIssuesByIdentifier,
  withAssignedIssueFilters,
} from '#src/utils/issues'

export function createStartCommand() {
  return withAssignedIssueFilters(
    new Command('start')
      .alias('branch')
      .description('start a git branch based on a linear issue')
      .action(async (opts) => {
        introTitle('Start branch')
        await exitIfInvalid()

        const groupValues = await group(
          {
            issuesMap: async () => {
              const spin = spinner()
              spin.start('Fetching issues matching filters')

              const issues = await getAssignedIssues(opts)

              spin.stop(
                `Fetched ${issues.length} issues matching filters ${JSON.stringify(opts)}`,
              )

              return mapIssuesByIdentifier(issues)
            },
            issueKey: async ({ results }) => {
              const issueChoices = Array.from(
                results['issuesMap']!.values(),
              ).map((issue) => {
                return {
                  label: colorize`{bold.blue ${issue.identifier}} {dim ${issue.title}}`,
                  value: issue.identifier,
                }
              })

              return await select({
                message: 'Pick an issue',
                options: issueChoices,
              })
            },
            branchName: ({ results }) => {
              const issue = results['issuesMap']!.get(
                results['issueKey'] as string,
              )!
              return text({
                message: colorize`Branch name {dim (${issue.identifier}_)}`,
                placeholder: v.kebabCase(issue.title),
                defaultValue: v.kebabCase(issue.title),
              })
            },
          },
          {
            onCancel: () => {
              exitWithCancel()
            },
          },
        )

        const branchName = `${groupValues['issueKey']}_${v.kebabCase(groupValues['branchName'] as string)}`

        await taskLogCommand('git', ['checkout', '-b', branchName])
        outro()
      }),
  )
}
