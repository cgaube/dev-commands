export function shrinkBranch(name: string, maxWidth: number): string {
  if (name.length <= maxWidth || maxWidth < 4) return name

  const segments = name.split('/')

  if (segments.length > 1) {
    // Shrink segments from the left, keeping the last segment intact.
    // feature/auth/login-flow → f/a/login-flow
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i] = segments[i][0]
      const candidate = segments.join('/')
      if (candidate.length <= maxWidth) return candidate
    }
    // All prefixes shrunk but still too long — truncate the last segment.
    const prefix = segments.slice(0, -1).join('/') + '/'
    const remaining = maxWidth - prefix.length - 1 // 1 for ellipsis
    if (remaining >= 1) {
      return prefix + segments.at(-1)!.slice(0, remaining) + '…'
    }
  }

  // No slashes or everything collapsed — simple truncate with ellipsis.
  return name.slice(0, maxWidth - 1) + '…'
}
