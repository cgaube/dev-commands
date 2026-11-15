import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { CliRenderer } from '@opentui/core'

// Open the text in the editor of the user ($VISUAL, $EDITOR, else vi), and
// return the text after the editor closes. The TUI stops while the editor
// runs: they share the terminal. `name` is the file name: the editor picks
// its syntax from it.
export async function editText(
  renderer: CliRenderer,
  text: string,
  name: string,
): Promise<string> {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vi'
  const dir = await mkdtemp(join(tmpdir(), 'git-tui-'))
  const file = join(dir, name)
  try {
    await writeFile(file, text)
    await renderer.suspend()
    try {
      // Through the shell: $EDITOR can have arguments, for example
      // "code --wait".
      const editing = Bun.spawn(['sh', '-c', `${editor} "$1"`, 'sh', file], {
        stdio: ['inherit', 'inherit', 'inherit'],
      })
      const code = await editing.exited
      if (code !== 0) throw new Error(`${editor} stopped with code ${code}`)
    } finally {
      await renderer.resume()
    }
    return await readFile(file, 'utf8')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
