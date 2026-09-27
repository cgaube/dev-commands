import { execa } from 'execa'

// Diffs longer than this are truncated before being sent to the AI provider,
// keeping us well inside the model's context window (~25k tokens) and clear of
// the command-line size limit on providers that pass input as an argument.
export const MAX_DIFF_CHARS = 100000

// Apply to every read-only git command. GIT_OPTIONAL_LOCKS=0 stops them
// (notably `git status`) from taking the index lock to refresh its stat cache,
// which avoids lock contention with any concurrent git process or editor
// integration. Only safe on reads; writes take a required lock this flag does
// not affect, so it would be a no-op there anyway.
export const READ_ONLY_GIT_ENV = { GIT_OPTIONAL_LOCKS: '0' } as const

export async function gitOutput(args: string[]): Promise<string> {
  const { stdout } = await execa('git', args, { env: READ_ONLY_GIT_ENV })
  return stdout.toString()
}

// Clamp a diff to MAX_DIFF_CHARS, appending a marker so the AI provider knows it
// is seeing only the first portion. Callers decide how to package the text and
// whether to warn the user, hence the `truncated` flag.
export function truncateDiff(diff: string): {
  text: string
  truncated: boolean
} {
  if (diff.length <= MAX_DIFF_CHARS) {
    return { text: diff, truncated: false }
  }
  return {
    text: `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`,
    truncated: true,
  }
}
