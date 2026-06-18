import { Command, Option } from 'commander'
import { cancel, log, note } from '@clack/prompts'
import { colors, colorize, introTitle, exitWithError } from '#common/style'
import { resolveProvider, generateWithAI } from '#common/ai'
import { gitOutput, MAX_DIFF_CHARS, truncateDiff } from '../utils/git'
import { reviewPrompt } from '../utils/prompts'

type Options = {
  base?: string
  commits?: string
  ai?: string
}

type Resolved = { source: string; diff: string }

async function isWorkingTreeDirty(): Promise<boolean> {
  const status = await gitOutput(['status', '--porcelain'])
  return status.split(/\r?\n/).some((l) => l.trim().length > 0)
}

async function resolveDiff(options: Options): Promise<Resolved> {
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
    }
  }

  if (options.base) {
    const range = `${options.base}...HEAD`
    return {
      source: `HEAD vs ${options.base}`,
      diff: await gitOutput(['diff', range]),
    }
  }

  if (await isWorkingTreeDirty()) {
    return {
      source: 'working tree vs HEAD',
      diff: await gitOutput(['diff', 'HEAD']),
    }
  }

  exitWithError(
    'Working tree is clean. Pass --base <ref> or -n <count> to choose what to review.',
  )
  throw new Error('unreachable')
}

export function createReviewCommand() {
  return new Command('review')
    .description('review your changes before pushing')
    .addOption(
      new Option(
        '--base <ref>',
        'review HEAD against <ref> (e.g. main)',
      ).conflicts('commits'),
    )
    .addOption(
      new Option(
        '-n, --commits <count>',
        'review the last <count> commits',
      ).conflicts('base'),
    )
    .option('--ai <provider>', 'ai provider (claude, codex, opencode)')
    .action(async (options: Options) => {
      introTitle('Git Review')

      const provider = resolveProvider(options.ai)
      const { source, diff } = await resolveDiff(options)

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

      // Oversized diffs are truncated rather than handed off for the agent to
      // fetch: the review stays complete and deterministic for what it sees, and
      // the warning below tells the user the rest wasn't covered.
      const { text: input, truncated } = truncateDiff(diff)

      if (truncated) {
        log.warn(
          `Diff is ${diff.length} chars; reviewing only the first ${MAX_DIFF_CHARS}. ` +
            'Narrow the scope (--base, -n, or fewer files) for a complete review.',
        )
      }

      log.info(colorize`Reviewing {bold ${source}}`)

      const review = await generateWithAI(provider, reviewPrompt(), input)

      if (!review.trim()) {
        return cancel('AI returned no review.')
      }

      note(review, 'Review', {
        format: (line: string) => colors.reset(line),
      })
    })
}
