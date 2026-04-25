import { Command } from 'commander'
import { outro, cancel, isCancel, confirm, log } from '@clack/prompts'
import { execa } from 'execa'
import { colors, colorize, introTitle } from '#common/style'
import { spinnerCallback } from '#common/commands'
import { resolveProvider, generateWithAI } from '#common/ai'
import { gitOutput } from '../utils/git'
import { COMMIT_PROMPT } from '../utils/prompts'

const MAX_DIFF_CHARS = 15000

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

      await execa('git', ['add', '-A'])

      const [stat, diff] = await Promise.all([
        gitOutput(['diff', '--cached', '--stat']),
        gitOutput(['diff', '--cached']),
      ])

      const context =
        diff.length > MAX_DIFF_CHARS
          ? `## Diff stat\n${stat.trim() || '(empty)'}\n\n## Diff (truncated)\n${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`
          : `## Diff stat\n${stat.trim() || '(empty)'}\n\n## Diff\n${diff}`

      const message = await generateWithAI(provider, COMMIT_PROMPT, context)

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
