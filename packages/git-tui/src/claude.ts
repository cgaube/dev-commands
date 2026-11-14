// Resolve rebase conflicts with Claude Code in the background.
//
// Claude Code is optional. Without the `claude` command, or with the
// `conflictAgent` setting at `off`, the TUI shows the manual steps only.
//
// The TUI runs `claude -p` (print mode) with the login of the user. Claude
// can only read and edit files, and run read-only git commands and
// `git add`. It cannot continue, abort or commit: the TUI does these steps.

import type { Subprocess } from 'bun'
import type { Repo } from './data/git'

export function isClaudeInstalled(): boolean {
  return !!Bun.which('claude')
}

// The tools that Claude can use. In print mode, Claude cannot ask for more,
// so a tool that is not in this list fails.
const ALLOWED_TOOLS = [
  'Read',
  'Edit',
  'Grep',
  'Glob',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git add:*)',
]

function prompt(repo: Repo): string {
  const kind =
    repo.rebase === 'stack' ? 'a `gh stack rebase`' : 'a `git rebase`'
  return [
    `${kind} stopped on merge conflicts in this repository.`,
    '',
    'Files with conflicts:',
    ...repo.conflicts.map((f) => `- ${f}`),
    '',
    'Do these steps:',
    '1. Use `git status`, `git log` and `git show` to find the commit that is applied and the base it is applied to.',
    '2. Resolve each conflict in the files. Keep the intent of both sides. Remove all the conflict markers.',
    '3. Stage each resolved file with `git add <file>`.',
    '4. Reply with a short summary: one line for each file, that tells how you resolved it.',
    '',
    'When you cannot resolve a conflict safely, do not stage that file, and tell why in the summary.',
    'Do NOT run `git rebase`, `git commit`, `git checkout`, `git reset` or any `gh` command.',
  ].join('\n')
}

export type AgentEvent =
  | { type: 'step'; text: string }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string }

// One short line for a tool call, for example "editing src/a.ts".
function describeTool(name: string, input: any): string {
  const file = input?.file_path ?? input?.path ?? input?.pattern ?? ''
  switch (name) {
    case 'Read':
      return `reading ${file}`
    case 'Edit':
      return `editing ${file}`
    case 'Grep':
    case 'Glob':
      return `searching ${file}`
    case 'Bash':
      return `$ ${input?.command ?? ''}`
    default:
      return name
  }
}

function toEvents(data: any): AgentEvent[] {
  if (data.type === 'assistant') {
    return (data.message?.content ?? [])
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({ type: 'step', text: describeTool(c.name, c.input) }))
  }
  if (data.type === 'result') {
    return data.is_error || data.subtype !== 'success'
      ? [{ type: 'error', message: String(data.result ?? data.subtype) }]
      : [{ type: 'done', summary: String(data.result ?? '') }]
  }
  return []
}

export type AgentRun = {
  // Resolves with the summary of Claude. Rejects when Claude fails or the
  // run is cancelled.
  result: Promise<string>
  cancel: () => void
}

// Start Claude on the conflicts of the repository. Each tool call goes to
// onStep, so that the TUI can show the progress.
export function resolveConflicts(
  repo: Repo,
  onStep: (text: string) => void,
): AgentRun {
  const child: Subprocess<'ignore', 'pipe', 'pipe'> = Bun.spawn(
    [
      'claude',
      '-p',
      prompt(repo),
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      ...ALLOWED_TOOLS,
    ],
    { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
  )
  let cancelled = false

  const result = (async () => {
    let summary: string | null = null
    let error: string | null = null
    let buffer = ''
    const decoder = new TextDecoder()
    for await (const chunk of child.stdout) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        let data: unknown
        try {
          data = JSON.parse(line)
        } catch {
          continue
        }
        for (const event of toEvents(data)) {
          if (event.type === 'step') onStep(event.text)
          else if (event.type === 'done') summary = event.summary
          else error = event.message
        }
      }
    }
    const code = await child.exited
    if (cancelled) throw new Error('Claude was stopped')
    if (error) throw new Error(`Claude failed: ${error}`)
    if (code !== 0 || summary === null) {
      const stderr = (await new Response(child.stderr).text()).trim()
      throw new Error(
        `Claude failed: ${stderr.split('\n').at(-1) || `exit ${code}`}`,
      )
    }
    return summary
  })()

  return {
    result,
    cancel: () => {
      cancelled = true
      child.kill()
    },
  }
}
