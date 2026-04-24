import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spinner } from '@clack/prompts'
import { execa, ExecaError } from 'execa'
import { colorize, exitWithError } from './style'

export type AIProvider = {
  name: string
  run: (prompt: string, input?: string) => Promise<string>
}

function execOptions(input?: string) {
  if (input !== undefined) {
    return { input, stdin: 'pipe' as const }
  }

  // `codex exec` inspects stdin. If we leave it open with the default pipe,
  // it can wait for extra input instead of just using the prompt argument.
  return { stdin: 'ignore' as const }
}

async function runClaude(prompt: string, input?: string): Promise<string> {
  const { stdout } = await execa('claude', ['-p', prompt], execOptions(input))
  return stdout.toString().trim()
}

async function runOpenCode(prompt: string, input?: string): Promise<string> {
  const fullPrompt = input !== undefined ? `${prompt}\n\n${input}` : prompt
  const { stdout } = await execa('opencode', ['run', fullPrompt], {
    stdin: 'ignore',
  })
  return stdout.toString().trim()
}

async function runCodex(prompt: string, input?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'devcli-codex-'))
  const file = join(dir, 'last-message.txt')
  try {
    await execa(
      'codex',
      [
        '--ask-for-approval',
        'never',
        'exec',
        '--color',
        'never',
        '--ephemeral',
        '--output-last-message',
        file,
        prompt,
      ],
      execOptions(input),
    )

    const content = await readFile(file, 'utf8')
    return content.trim()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export const AI_PROVIDERS: Record<string, AIProvider> = {
  claude: { name: 'claude', run: runClaude },
  codex: { name: 'codex', run: runCodex },
  opencode: { name: 'opencode', run: runOpenCode },
}

const DEFAULT_PROVIDER = 'claude'

export function resolveProvider(name?: string): AIProvider {
  const picked = name ?? process.env.DEV_AI_PROVIDER ?? DEFAULT_PROVIDER
  const provider = AI_PROVIDERS[picked]

  if (!provider) {
    const known = Object.keys(AI_PROVIDERS).join(', ')
    exitWithError(`Unknown AI provider "${picked}". Known providers: ${known}.`)
    throw new Error('unreachable')
  }
  return provider
}

export async function generateWithAI(
  provider: AIProvider,
  prompt: string,
  input?: string,
): Promise<string> {
  const s = spinner()
  s.start(colorize`{blue Generating with} {bold ${provider.name}}`)

  try {
    const result = await provider.run(prompt, input)
    s.stop(colorize`{green Generated with} {bold ${provider.name}}`)
    return result
  } catch (error) {
    s.stop(colorize`{red ${provider.name} failed}`)
    if (error instanceof ExecaError) {
      exitWithError(colorize`{dim ${error.shortMessage || error.message}}`)
    }
    throw error
  }
}
