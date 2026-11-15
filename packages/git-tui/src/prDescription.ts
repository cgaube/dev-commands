// Write the title and the description of a new PR with an AI CLI (claude by
// default, see common/ai.ts). The TUI shows the result before the push.

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { AI_PROVIDERS, type AIProvider } from '#common/ai'
import { getConfig } from './config'
import { git } from './data/exec'
import type { Repo } from './data/git'
import type { Row } from './data/model'

// A diff longer than this is cut, so that the prompt stays small.
const MAX_DIFF_CHARS = 60_000

// The places where GitHub looks for a PR template.
const TEMPLATES = [
  '.github/pull_request_template.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/pull_request_template.md',
  'pull_request_template.md',
]

const PROMPT = `You write the title and the description of a GitHub pull request. The input below has the branch name, the base branch, the commits, the diff stat and the diff (it can end with a "[diff truncated]" marker).

The project instructions (CLAUDE.md or AGENTS.md) can define a format for PR titles or descriptions. If they do, you MUST use that format. Get the ticket key from the branch name when one is given.

When the input has a PR template, fill in the template: keep its headings, and remove the parts that do not apply.

Write in ASD-STE100 Simplified Technical English: short sentences, simple words, active voice.

Title (line 1)
- Imperative subject, 70 chars max, no trailing period, no "Title:" prefix.

Description (from line 3, Markdown)
- Line 2 is blank.
- Without a template: a short paragraph that tells what changes for the user or the code, then a "## Changes" list of 2-6 bullets.
- Say what behavior is different now. Do not list every file.
- Give a reason only if the commits or the diff show it. Never guess a reason.
- Do not add filler, and do not end with a summary.

Output only the title and the description. No preamble, no code fences around the whole response.`

export type PrText = { title: string; body: string }

// The provider from the `prAgent` setting, when its command is installed.
export async function prProvider(): Promise<AIProvider | null> {
  const name = await getConfig('prAgent')
  const provider = AI_PROVIDERS[name]
  if (!provider || !Bun.which(provider.name)) return null
  return provider
}

async function readTemplate(): Promise<string | null> {
  const root = await git(['rev-parse', '--show-toplevel'])
  const file = TEMPLATES.map((t) => join(root, t)).find((f) => existsSync(f))
  return file ? readFile(file, 'utf8') : null
}

async function prInput(repo: Repo, row: Row): Promise<string> {
  const base = repo.defaultBranch
  const range = `${base}...${row.name}`
  const [commits, stat, diff, template] = await Promise.all([
    git(['log', '--reverse', '--format=- %s%n%b', `${base}..${row.name}`]),
    git(['diff', '--stat', range]),
    git(['diff', range]),
    readTemplate(),
  ])
  const cut =
    diff.length > MAX_DIFF_CHARS
      ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`
      : diff
  return [
    `Branch: ${row.name}`,
    `Base: ${base}`,
    '',
    '## Commits',
    commits,
    '',
    ...(template ? ['## PR template', template, ''] : []),
    '## Diff stat',
    stat,
    '',
    '## Diff',
    cut,
  ].join('\n')
}

// Split the answer: the first line is the title, the rest is the body.
function parse(answer: string): PrText {
  const text = answer
    .trim()
    .replace(/^```(?:markdown|md)?\n([\s\S]*)\n```$/, '$1')
    .trim()
  const [first = '', ...rest] = text.split('\n')
  const title = first
    .replace(/^#+\s*/, '')
    .replace(/^title:\s*/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .trim()
  if (!title) throw new Error('the AI gave an empty answer')
  return { title, body: rest.join('\n').trim() }
}

export async function generatePrText(
  provider: AIProvider,
  repo: Repo,
  row: Row,
): Promise<PrText> {
  const input = await prInput(repo, row)
  return parse(await provider.run(PROMPT, input))
}
