import { LinearClient } from '@linear/sdk'
import type { User } from '@linear/sdk'
import { getConfig } from '#src/config'
import type { IssueFilters, NormalizedIssue } from '#src/types'

type LinearFilters = NonNullable<
  Parameters<User['assignedIssues']>[0]
>['filter']

async function buildClient() {
  const apiKey = await getConfig('apiKey')
  return new LinearClient({ apiKey })
}

export async function getCurrentUser() {
  const client = await buildClient()
  return client.viewer
}

export async function getAssignedIssues(
  options: IssueFilters = {},
): Promise<NormalizedIssue[]> {
  const client = await buildClient()
  const viewer = await client.viewer

  const filter: LinearFilters = {}
  const conditions: LinearFilters[] = []

  if (options.state?.length) {
    conditions.push({ state: { name: { in: options.state } } })
  }

  if (options.team?.length) {
    conditions.push({
      or: [
        { team: { name: { in: options.team } } },
        {
          team: { key: { in: options.team.map((t) => t.toUpperCase()) } },
        },
      ],
    })
  }

  if (options.label?.length) {
    conditions.push({ labels: { name: { in: options.label } } })
  }

  if (conditions.length === 1) {
    Object.assign(filter, conditions[0])
  } else if (conditions.length > 1) {
    filter.and = conditions as Exclude<typeof filter.and, undefined>
  }

  const result = await viewer.assignedIssues({ filter })

  return Promise.all(
    result.nodes.map(async (issue) => {
      const [state, team] = await Promise.all([issue.state, issue.team])
      return {
        key: issue.identifier,
        title: issue.title,
        state: state?.name,
        group: team?.name,
        url: issue.url,
      }
    }),
  )
}
