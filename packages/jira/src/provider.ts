import { Version3Client } from 'jira.js'
import { getConfig } from '#src/config'
import type { IssueFilters, NormalizedIssue } from '#src/types'

function escapeJql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function jqlList(values: string[]): string {
  return values.map((v) => `"${escapeJql(v)}"`).join(', ')
}

function buildJql(filters: IssueFilters): string {
  const clauses = ['assignee = currentUser()']

  if (filters.state?.length) {
    clauses.push(`status in (${jqlList(filters.state)})`)
  }

  if (filters.project?.length) {
    const names = jqlList(filters.project)
    const keys = jqlList(filters.project.map((p) => p.toUpperCase()))
    clauses.push(`(project in (${names}) OR project in (${keys}))`)
  }

  if (filters.label?.length) {
    clauses.push(`labels in (${jqlList(filters.label)})`)
  }

  return clauses.join(' AND ')
}

async function buildClient() {
  const [host, email, apiToken] = await Promise.all([
    getConfig('host'),
    getConfig('email'),
    getConfig('apiToken'),
  ])

  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const client = new Version3Client({
    host: `https://${cleanHost}`,
    authentication: { basic: { email, apiToken } },
  })

  return { client, host: cleanHost }
}

export async function getAssignedIssues(
  filters: IssueFilters = {},
): Promise<NormalizedIssue[]> {
  const { client, host } = await buildClient()

  const jql = buildJql(filters)

  const result = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch(
    {
      jql,
      fields: ['summary', 'status', 'project', 'labels'],
    },
  )

  const issues = result.issues ?? []

  return issues.map((issue: any) => ({
    key: issue.key,
    title: issue.fields?.summary ?? '',
    state: issue.fields?.status?.name,
    group: issue.fields?.project?.name,
    url: `https://${host}/browse/${issue.key}`,
  }))
}

export async function getCurrentUser() {
  const { client, host } = await buildClient()
  const user = await client.myself.getCurrentUser()
  return { user, host }
}
