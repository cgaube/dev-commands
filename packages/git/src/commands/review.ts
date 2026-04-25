import { Command } from 'commander'
import { outro, cancel, log } from '@clack/prompts'
import { execa, ExecaError } from 'execa'
import { colors, colorize, introTitle, exitWithError } from '#common/style'
import { resolveProvider, generateWithAI } from '#common/ai'
import { gitOutput } from '../utils/git'
import { REVIEW_PROMPT } from '../utils/prompts'

const MAX_DIFF_CHARS = 15000

type Options = {
  base?: string
  commits?: string
  pr?: string
  ai?: string
}

type Resolved = { source: string; diff: string; statArgs?: string[] }

async function isWorkingTreeDirty(): Promise<boolean> {
  const status = await gitOutput(['status', '--porcelain'])
  return status.split(/\r?\n/).some((l) => l.trim().length > 0)
}

async function resolveDiff(options: Options): Promise<Resolved> {
  if (options.pr) {
    try {
      const { stdout } = await execa('gh', ['pr', 'diff', options.pr])
      return { source: `PR #${options.pr}`, diff: stdout.toString() }
    } catch (err) {
      const rawStderr =
        err instanceof ExecaError ? (err as { stderr?: unknown }).stderr : ''
      const stderr = typeof rawStderr === 'string' ? rawStderr.trim() : ''
      const detail =
        stderr ||
        (err instanceof ExecaError
          ? err.shortMessage
          : err instanceof Error
            ? err.message
            : String(err))
      exitWithError(
        `Failed to fetch PR #${options.pr}: ${detail}\nIs \`gh\` installed and authenticated?`,
      )
      throw new Error('unreachable')
    }
  }

  if (options.commits) {
    const n = Number(options.commits)
    if (!Number.isInteger(n) || n < 1) {
      exitWithError(`-n must be a positive integer, got "${options.commits}".`)
    }
    const total = Number(
      (await gitOutput(['rev-list', '--count', 'HEAD'])).trim(),
    )
    if (n >= total) {
      exitWithError(
        `Cannot review last ${n} commit${n === 1 ? '' : 's'}: only ${total} on this branch.`,
      )
    }
    const range = `HEAD~${n}...HEAD`
    return {
      source: `last ${n} commit${n === 1 ? '' : 's'}`,
      diff: await gitOutput(['diff', range]),
      statArgs: ['diff', '--stat', range],
    }
  }

  if (options.base) {
    const range = `${options.base}...HEAD`
    return {
      source: `HEAD vs ${options.base}`,
      diff: await gitOutput(['diff', range]),
      statArgs: ['diff', '--stat', range],
    }
  }

  if (await isWorkingTreeDirty()) {
    return {
      source: 'working tree vs HEAD',
      diff: await gitOutput(['diff', 'HEAD']),
      statArgs: ['diff', '--stat', 'HEAD'],
    }
  }

  exitWithError(
    'Working tree is clean. Pass --base <ref> or -n <count> to choose what to review.',
  )
  throw new Error('unreachable')
}

function truncateAtHunkBoundary(diff: string, max: number): string {
  if (diff.length <= max) return diff
  const slice = diff.slice(0, max)
  const lastFile = slice.lastIndexOf('\ndiff --git ')
  if (lastFile > max / 2) return slice.slice(0, lastFile)
  const lastHunk = slice.lastIndexOf('\n@@ ')
  return lastHunk > 0 ? slice.slice(0, lastHunk) : slice
}

function validateMutuallyExclusive(options: Options) {
  const picked = [
    options.pr && '--pr',
    options.base && '--base',
    options.commits && '-n',
  ].filter(Boolean) as string[]
  if (picked.length > 1) {
    exitWithError(
      `Pick one source. Got: ${picked.join(', ')}. Use --help for details.`,
    )
  }
}

export function createReviewCommand() {
  return new Command('review')
    .description('review your changes before pushing')
    .option('--base <ref>', 'review HEAD against <ref> (e.g. main)')
    .option('-n, --commits <count>', 'review the last <count> commits')
    .option('--pr <num>', 'review a github pr by number (uses gh)')
    .option('--ai <provider>', 'ai provider (claude, codex, opencode)')
    .action(async (options: Options) => {
      introTitle('Git Review')

      validateMutuallyExclusive(options)

      const provider = resolveProvider(options.ai)
      const { source, diff, statArgs } = await resolveDiff(options)

      if (!diff.trim()) {
        const untracked = (
          await gitOutput(['ls-files', '--others', '--exclude-standard'])
        ).trim()
        return cancel(
          untracked
            ? 'Only untracked files. Run `git add` to include them in the review.'
            : `Nothing to review (${source}).`,
        )
      }

      let context = diff
      if (diff.length > MAX_DIFF_CHARS) {
        const truncated = truncateAtHunkBoundary(diff, MAX_DIFF_CHARS)
        const stat = statArgs ? (await gitOutput(statArgs)).trim() : ''
        log.warn(
          `Diff is ${diff.length} chars; truncating to ${truncated.length}.`,
        )
        const parts: string[] = []
        if (stat) parts.push(`## Diff stat\n${stat}`)
        parts.push(`## Diff (truncated)\n${truncated}\n\n[diff truncated]`)
        context = parts.join('\n\n')
      }

      log.info(colorize`Reviewing {bold ${source}}`)

      const review = await generateWithAI(provider, REVIEW_PROMPT, context)

      if (!review.trim()) {
        return cancel('AI returned no review.')
      }

      log.message(review)
      log.message(colors.dim(`— reviewed by ${provider.name}`))

      outro()
    })
}
