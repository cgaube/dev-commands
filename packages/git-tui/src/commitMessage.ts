// Write a commit message with the AI CLI of the `prAgent` setting. The TUI
// shows the message before the commit.

import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AIProvider } from '#common/ai'
import { git, gitOrNull, run } from './data/exec'
import type { Repo } from './data/git'
import { cutDiff, splitText, type PrText } from './prDescription'

// What the commit takes. `staged`: only the changes in the index, because
// the user chose them with git add. `all`: all the changes, also the new
// files.
export type CommitScope = 'staged' | 'all'

const PROMPT = `You write a git commit message for the changes below. The input has the branch name, the subjects of the recent commits, the diff stat and the diff (it can end with a "[diff truncated]" marker).

The project instructions (CLAUDE.md or AGENTS.md) can define a format for commit messages. If they do, you MUST use that format. If not, use the style of the recent commits.

Write in ASD-STE100 Simplified Technical English: short sentences, simple words, active voice.

Subject (line 1)
- Imperative, 72 chars max, no trailing period.

Body (from line 3, optional)
- Line 2 is blank.
- Add a body only when the subject cannot tell the change alone. Tell what is different now. Wrap the lines at 72 characters.
- Give a reason only if the diff shows it. Never guess a reason.
- Do not add filler, and do not list every file.

Output only the commit message. No preamble, no code fences.`

// When the user staged changes, commit only them. Else commit all.
export async function commitScope(): Promise<CommitScope> {
  // `--quiet` fails when the index has changes.
  const clean = await gitOrNull(['diff', '--cached', '--quiet'])
  return clean === null ? 'staged' : 'all'
}

// The diff of the commit. For `all`, add all the changes to a temporary
// index: the index of the user stays as it is until the commit.
async function commitDiff(
  scope: CommitScope,
): Promise<{ stat: string; diff: string }> {
  if (scope === 'staged') {
    const [stat, diff] = await Promise.all([
      git(['diff', '--cached', '--stat']),
      git(['diff', '--cached']),
    ])
    return { stat, diff }
  }
  const dir = await mkdtemp(join(tmpdir(), 'git-tui-'))
  const env = { GIT_INDEX_FILE: join(dir, 'index'), GIT_OPTIONAL_LOCKS: '0' }
  try {
    // A repository without a commit has no HEAD: start from an empty index.
    if (await gitOrNull(['rev-parse', '--verify', '--quiet', 'HEAD']))
      await run('git', ['read-tree', 'HEAD'], { env })
    await run('git', ['add', '--all'], { env })
    const [stat, diff] = await Promise.all([
      run('git', ['diff', '--cached', '--stat'], { env }),
      run('git', ['diff', '--cached'], { env }),
    ])
    return { stat, diff }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function generateCommitMessage(
  provider: AIProvider,
  repo: Repo,
  scope: CommitScope,
): Promise<PrText> {
  const [{ stat, diff }, recent] = await Promise.all([
    commitDiff(scope),
    gitOrNull(['log', '-10', '--format=- %s']),
  ])
  if (!diff) throw new Error('nothing to commit')
  const input = [
    `Branch: ${repo.currentBranch}`,
    '',
    '## Recent commits',
    recent || '(none)',
    '',
    '## Diff stat',
    stat,
    '',
    '## Diff',
    cutDiff(diff),
  ].join('\n')
  return splitText(await provider.run(PROMPT, input))
}
