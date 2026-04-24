import { readFile, stat } from 'node:fs/promises'
import { Command } from 'commander'
import { outro, cancel, isCancel, confirm, log } from '@clack/prompts'
import { execa } from 'execa'
import { colors, colorize, introTitle } from '#common/style'
import { spinnerCallback } from '#common/commands'
import { resolveProvider, generateWithAI } from '#common/ai'
import { gitOutput } from '../utils/git'

const MAX_DIFF_CHARS = 15000
const MAX_UNTRACKED_FILE_BYTES = 32 * 1024

const FORMAT_RULES = `Format (exact):
- Line 1: imperative subject, 50 chars max, no trailing period.
- Line 2: blank.
- Lines 3+: 1-3 short lines describing WHY the change was made, not WHAT.

Output only the commit message. No preamble, no code fences, no quotes.`

const COMMIT_PROMPT_FULL = `You are writing a git commit message. The input below contains the full repository context (status, diff --stat, tracked diff, and untracked file contents). Use only the provided context — do not run git yourself.

${FORMAT_RULES}`

const COMMIT_PROMPT_PARTIAL = `Write a git commit message for the changes in this repository.

${FORMAT_RULES}`

async function readUntrackedFiles(): Promise<string> {
  const list = (await gitOutput(['ls-files', '--others', '--exclude-standard']))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const sections: string[] = []

  for (const path of list) {
    try {
      const info = await stat(path)
      if (!info.isFile()) continue
      if (info.size > MAX_UNTRACKED_FILE_BYTES) {
        sections.push(`=== NEW FILE: ${path} (${info.size} bytes, omitted) ===`)
        continue
      }
      const content = await readFile(path, 'utf8')
      sections.push(`=== NEW FILE: ${path} ===\n${content}`)
    } catch {
      sections.push(`=== NEW FILE: ${path} (unreadable, skipped) ===`)
    }
  }
  return sections.join('\n\n')
}

type CommitContext = { prompt: string; context: string }

async function buildCommitContext(
  statusPorcelain: string,
): Promise<CommitContext> {
  const [diffStat, fullDiff, untracked] = await Promise.all([
    gitOutput(['diff', '--stat', 'HEAD']),
    gitOutput(['diff', 'HEAD']),
    readUntrackedFiles(),
  ])

  const over = fullDiff.length + untracked.length > MAX_DIFF_CHARS

  if (over) {
    const untrackedList = untracked
      .split('\n')
      .filter((l) => l.startsWith('=== NEW FILE'))
      .join('\n')

    const context = [
      '## Status (porcelain)',
      statusPorcelain || '(empty)',
      '',
      '## Diff stat',
      diffStat.trim() || '(empty)',
      '',
      '## Untracked files',
      untrackedList || '(none)',
    ].join('\n')

    return { prompt: COMMIT_PROMPT_PARTIAL, context }
  }

  const context = [
    '## Status (porcelain)',
    statusPorcelain || '(empty)',
    '',
    '## Diff stat',
    diffStat.trim() || '(empty)',
    '',
    '## Tracked diff',
    fullDiff || '(no tracked changes)',
    '',
    '## Untracked files',
    untracked || '(no untracked files)',
  ].join('\n')

  return { prompt: COMMIT_PROMPT_FULL, context }
}

export function createCommitCommand() {
  return new Command('commit')
    .description('generate and commit with ai message')
    .option('--ai <provider>', 'ai provider (claude, codex, opencode)')
    .action(async (options: { ai?: string }) => {
      introTitle('Git Commit')

      const provider = resolveProvider(options.ai)

      const statusPorcelain = await gitOutput(['status', '--porcelain'])
      const hasChanges = statusPorcelain
        .split(/\r?\n/)
        .some((line) => line.trim().length > 0)

      if (!hasChanges) {
        return cancel('Nothing to commit. Working tree is clean.')
      }

      const { prompt, context } = await buildCommitContext(statusPorcelain)

      const message = await generateWithAI(provider, prompt, context)

      const [rawTitle, ...rest] = message.split('\n')
      const title = rawTitle.trim()
      const body = rest.join('\n').trim()

      if (!title) {
        return cancel('AI returned an empty message.')
      }

      log.message(colorize`{bold ${title}}`)
      if (body) {
        log.message(colors.dim(body))
      }

      const confirmed = await confirm({ message: 'Commit with this message?' })
      if (isCancel(confirmed) || !confirmed) {
        return cancel('Commit cancelled.')
      }

      const commitArgs = ['commit', '-m', title]
      if (body) commitArgs.push('-m', body)

      await spinnerCallback(
        async () => {
          await execa('git', ['add', '-A'])
          await execa('git', commitArgs)
        },
        {
          startMessage: 'Committing',
          successMessage: 'Committed',
        },
      )

      outro()
    })
}
