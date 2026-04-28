import { Command } from 'commander'
import { relative } from 'node:path'
import { colors } from '#common/style'
import { discoverScripts } from '#src/sources'
import type { SourceId } from '#src/sources'

export function createListCommand() {
  return new Command('list')
    .description('list all discovered scripts')
    .option('--source <id>', 'filter by source')
    .option('--json', 'output as JSON')
    .action(async (options: { source?: SourceId; json?: boolean }) => {
      const result = await discoverScripts(process.cwd())
      const filtered = options.source
        ? result.scripts.filter((s) => s.source === options.source)
        : result.scripts

      if (options.json) {
        console.log(
          JSON.stringify(
            { scripts: filtered, warnings: result.warnings },
            null,
            2,
          ),
        )
        return
      }

      for (const w of result.warnings) {
        console.log(colors.yellow(`! ${w}`))
      }

      if (filtered.length === 0) {
        console.log(colors.dim('No scripts found.'))
        return
      }

      const sourceWidth = Math.max(...filtered.map((s) => s.source.length))
      const nameWidth = Math.max(...filtered.map((s) => s.name.length))

      for (const s of filtered) {
        const src = colors.cyan(s.source.padEnd(sourceWidth))
        const name = s.name.padEnd(nameWidth)
        const cwdRel = relative(process.cwd(), s.cwd) || '.'
        const desc = s.description
          ? colors.dim(`— ${s.description.replace(/\s+/g, ' ').trim()}`)
          : ''
        console.log(`${src}  ${name}  ${colors.dim(cwdRel)}  ${desc}`)
      }
    })
}
