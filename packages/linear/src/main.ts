import { devCliProgram } from '#common/devCliProgram'
import { injectConfigCommands, exitIfInvalid } from '#src/config'
import { linearViewer } from '#src/clients/linear'
import { introTitle, colorize, exitWithCancel } from '#common/style'
import type { User } from '@linear/sdk'
import { select, spinner, text, group, outro } from '@clack/prompts'
import v from 'voca'
import { taskLogCommand } from '#common/commands'

const linear = devCliProgram({
  name: 'linear',
  summary: 'Linear related dev commands',
})

injectConfigCommands(linear)

// Sub commands
linear
  .command('start')
  .alias('branch')
  .description('Start a git branch based on a linear issue')
  .option('--team <teams...>', 'override teams to filter issues by')
  .option('--label <labels...>', 'override labels to filter issues by')
  .option('--state <states...>', 'override statuses to filter issues by', [
    'In Progress',
  ])
  .action(async (opts) => {
    introTitle('Start branch')
    await exitIfInvalid()

    const groupValues = await group(
      {
        issuesMap: async () => {
          const spin = spinner()
          spin.start(`Fetching issues matching filters `)

          const linear = await linearViewer()

          type Filters = NonNullable<
            Parameters<User['assignedIssues']>[0]
          >['filter']
          const filter: Filters = {
            state: { name: { in: opts.state } },
          }
          if (opts.teams) {
            filter.team = { name: { in: opts.teams } }
          }
          if (opts.labels) {
            filter.labels = { name: { in: opts.labels } }
          }

          const issuesResult = await linear.assignedIssues({ filter })
          spin.stop(
            `Fetched ${issuesResult.nodes.length} issues matching filters ${JSON.stringify(opts)}`,
          )

          const issues = issuesResult.nodes
          return new Map(
            issues.map((issue) => {
              return [issue.identifier, issue]
            }),
          )
        },
        issueKey: async ({ results }) => {
          const issueChoices = Array.from(results['issuesMap']!.values()).map(
            (issue) => {
              return {
                label: colorize`{bold.blue ${issue.identifier}} {dim ${issue.title}}`,
                value: issue.identifier,
              }
            },
          )

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
  })

linear.parse()
