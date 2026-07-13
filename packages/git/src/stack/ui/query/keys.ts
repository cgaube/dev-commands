export const queryKeys = {
  all: ['stack'] as const,
  forest: () => [...queryKeys.all, 'forest'] as const,
  branch: (name: string) => [...queryKeys.all, 'branch', name] as const,
  log: (name: string) => [...queryKeys.branch(name), 'log'] as const,
  pr: (name: string) => [...queryKeys.branch(name), 'pr'] as const,
}
