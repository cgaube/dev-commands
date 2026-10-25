import { secrets as bunSecrets } from 'bun'
import { execa } from 'execa'

type SecretKey = { service: string; name: string }

// The keychain trusts the app that created an item, by its code signature.
// `bun build --compile` signs each build ad hoc, so each new binary is a new
// app and macOS asks for the login password again. Like the GitHub CLI, run
// /usr/bin/security instead: it is the app that the keychain sees, and its
// signature does not change. The items are the same as Bun.secrets makes
// (service = svce, name = acct), so the stored secrets stay.
const SECURITY = '/usr/bin/security'

// The exit code of `security` when the item does not exist.
const NOT_FOUND = 44

// `security -i` reads the commands from stdin, so the value is not in the
// arguments that `ps` shows. The words of a command are not quoted.
function checkWord(word: string) {
  if (!/^[\w.@:-]+$/.test(word)) {
    throw new Error(`Invalid keychain service or name: ${word}`)
  }
}

// `-g` writes `password: "value"`, or `password: 0x<hex>  "..."` when the
// value is not printable ASCII.
function parsePassword(output: string): string {
  const line = output.split('\n').find((l) => l.startsWith('password:'))
  if (!line) return ''
  const hex = /^password: 0x([0-9A-Fa-f]*)/.exec(line)
  if (hex) return Buffer.from(hex[1], 'hex').toString('utf8')
  const start = line.indexOf('"')
  return start === -1 ? '' : line.slice(start + 1, line.lastIndexOf('"'))
}

const keychain = {
  async get({ service, name }: SecretKey): Promise<string | null> {
    const result = await execa(
      SECURITY,
      ['find-generic-password', '-s', service, '-a', name, '-g'],
      { reject: false },
    )
    if (result.exitCode === NOT_FOUND) return null
    if (result.failed) throw new Error(result.stderr.trim())
    return parsePassword(result.stderr)
  },

  async set({ service, name, value }: SecretKey & { value: string }) {
    checkWord(service)
    checkWord(name)
    const hex = Buffer.from(value, 'utf8').toString('hex')
    await execa(SECURITY, ['-i'], {
      input: `add-generic-password -U -s ${service} -a ${name} -X ${hex}\n`,
    })
  },

  async delete({ service, name }: SecretKey): Promise<boolean> {
    const result = await execa(
      SECURITY,
      ['delete-generic-password', '-s', service, '-a', name],
      { reject: false },
    )
    if (result.exitCode === NOT_FOUND) return false
    if (result.failed) throw new Error(result.stderr.trim())
    return true
  },
}

export const secrets = process.platform === 'darwin' ? keychain : bunSecrets
