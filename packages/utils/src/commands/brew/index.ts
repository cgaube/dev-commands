import { Command, Option } from 'commander'
import { log, outro, spinner } from '@clack/prompts'
import { colors, exitWithError, introTitle } from '#common/style'
import { loadBrewState, type BrewState } from './data'
import {
  renderCasks,
  renderOrphans,
  renderRoots,
  renderTree,
  type SortKey,
} from './render'

function toJson(state: BrewState) {
  return {
    roots: state.roots.map((r) => ({
      ...r,
      ...state.formulae.get(r.name),
      deps: undefined,
      dependents: undefined,
    })),
    casks: state.casks,
    orphans: state.orphans,
  }
}

export function createBrewCommand() {
  return new Command('brew')
    .description('shows what you installed with brew and what it pulled in')
    .argument('[formula]', 'show the dependency tree of one formula')
    .addOption(
      new Option('-s, --sort <key>', 'sort installed formulae')
        .choices(['size', 'name', 'updated'])
        .default('size'),
    )
    .option('--no-casks', 'hide casks')
    .option('--json', 'output machine-readable JSON')
    .action(async (formula: string | undefined, options) => {
      const json = options.json === true
      if (!json) introTitle('Brew')

      const spin = json ? undefined : spinner()
      spin?.start('Reading brew packages')
      let state: BrewState
      try {
        state = await loadBrewState()
      } catch (error) {
        spin?.error('Could not read brew packages')
        exitWithError(
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'brew is not installed or not in PATH.'
            : String((error as Error).message),
        )
        return
      }
      spin?.stop(
        `${state.roots.length} installed on request, ${state.formulae.size - state.roots.length} dependencies, ${state.casks.length} casks`,
      )

      if (formula) {
        if (!state.formulae.has(formula)) {
          exitWithError(`${formula} is not an installed formula.`)
        }
        if (json) {
          console.log(JSON.stringify(state.formulae.get(formula), null, 2))
          return
        }
        log.message(renderTree(state, formula))
        outro()
        return
      }

      if (json) {
        console.log(JSON.stringify(toJson(state), null, 2))
        return
      }

      log.message(renderRoots(state, options.sort as SortKey))
      if (options.casks && state.casks.length > 0) {
        log.message(renderCasks(state))
      }
      if (state.orphans.length > 0) {
        log.warn(
          `${colors.bold('Orphans')} ${colors.dim('— installed as dependencies, nothing needs them')}`,
        )
        log.message(renderOrphans(state))
      }
      outro(
        colors.dim(
          'FREES = space freed by uninstalling (own deps included) · UPDATED = last install or upgrade · dev utils brew <formula> for its tree',
        ),
      )
    })
}
