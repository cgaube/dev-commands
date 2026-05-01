export type NormalizedIssue = {
  key: string
  title: string
  state?: string
  group?: string
  url: string
}

export type IssueFilters = {
  project?: string[]
  label?: string[]
  state?: string[]
}
