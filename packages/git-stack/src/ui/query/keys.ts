export const queryKeys = {
  all: ['stack'] as const,
  state: () => [...queryKeys.all, 'state'] as const,
  branch: (name: string) => [...queryKeys.all, 'branch', name] as const,
  log: (name: string, base: string | null) =>
    [...queryKeys.branch(name), 'log', base] as const,
  pr: (name: string) => [...queryKeys.branch(name), 'pr'] as const,
}
