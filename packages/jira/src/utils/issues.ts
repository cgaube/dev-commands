import type { Command } from 'commander'
import { colorize, pill } from '#common/style'
import type { NormalizedIssue } from '#src/types'

export function withIssueFilters<T extends Command>(command: T) {
  return command
    .option(
      '--project <projects...>',
      'project keys or names to filter issues by',
    )
    .option('--label <labels...>', 'labels to filter issues by')
    .option('--state <states...>', 'statuses to filter issues by', [
      'In Progress',
    ])
}

export function mapIssuesByKey(issues: NormalizedIssue[]) {
  return new Map(issues.map((issue) => [issue.key, issue]))
}

function statePill(name: string | undefined) {
  return pill(name || 'No state', 'white', 'black')
}

export function formatIssue(issue: NormalizedIssue) {
  const heading = `${colorize`{bold.blue ${issue.key}}`} ${statePill(issue.state)}`
  const details = [issue.group, issue.url].filter(Boolean).join('  ')

  return [heading, issue.title, details ? colorize`{dim ${details}}` : '']
    .filter(Boolean)
    .join('\n')
}
