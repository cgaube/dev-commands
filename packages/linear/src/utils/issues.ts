import type { Command } from 'commander'
import { colorize, pill } from '#common/style'
import { linearViewer } from '#src/clients/linear'
import type { Issue, User } from '@linear/sdk'

export type AssignedIssueFilters = {
  team?: string[]
  label?: string[]
  state?: string[]
}

type Filters = NonNullable<Parameters<User['assignedIssues']>[0]>['filter']

export function withAssignedIssueFilters<T extends Command>(command: T) {
  return command
    .option(
      '--team <teams...>',
      'override team keys or names to filter issues by',
    )
    .option('--label <labels...>', 'override labels to filter issues by')
    .option('--state <states...>', 'override statuses to filter issues by', [
      'In Progress',
    ])
}

export async function getAssignedIssues(options: AssignedIssueFilters = {}) {
  const linear = await linearViewer()

  const filter: Filters = {}
  const conditions: Filters[] = []

  if (options.state?.length) {
    conditions.push({
      state: { name: { in: options.state } },
    })
  }

  if (options.team?.length) {
    conditions.push({
      or: [
        { team: { name: { in: options.team } } },
        {
          team: { key: { in: options.team.map((team) => team.toUpperCase()) } },
        },
      ],
    })
  }

  if (options.label?.length) {
    conditions.push({
      labels: { name: { in: options.label } },
    })
  }

  if (conditions.length === 1) {
    Object.assign(filter, conditions[0])
  } else if (conditions.length > 1) {
    filter.and = conditions as Exclude<typeof filter.and, undefined>
  }

  const issuesResult = await linear.assignedIssues({ filter })
  return issuesResult.nodes
}

export function mapIssuesByIdentifier(issues: Issue[]) {
  return new Map(
    issues.map((issue) => {
      return [issue.identifier, issue]
    }),
  )
}

function statePill(name: string | undefined) {
  return pill(name || 'No state', 'white', 'black')
}

export async function formatAssignedIssue(issue: Issue) {
  const state = await issue.state
  const team = await issue.team
  const heading = `${colorize`{bold.blue ${issue.identifier}}`} ${statePill(state?.name)}`
  const details = [team?.name, issue.url].filter(Boolean).join('  ')

  return [heading, issue.title, details ? colorize`{dim ${details}}` : '']
    .filter(Boolean)
    .join('\n')
}
