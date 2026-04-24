import { execa } from 'execa'

export async function gitOutput(args: string[]): Promise<string> {
  const { stdout } = await execa('git', args)
  return stdout.toString()
}
