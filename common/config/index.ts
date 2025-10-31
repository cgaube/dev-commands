import type { Command } from 'commander'
import type { ConfigSchema } from './types'
import {
  group,
  text,
  cancel,
  outro,
  log,
  confirm,
  note,
  tasks,
  multiselect,
  isCancel,
} from '@clack/prompts'
import { introTitle, colorize, exitWithError } from '../style'
import { homedir } from 'os'
import { ConfigStore } from './configStore'

export default function setupProgramConfiguration<TSchema extends ConfigSchema>(
  programName: string,
  configSchema: TSchema,
) {
  const buildConfigStore = async (dir: string = process.cwd()) => {
    const store = new ConfigStore(programName, dir, configSchema)
    await store.loadData()
    return store
  }

  let configStore: ConfigStore | undefined = undefined
  const getConfigStore = async () => {
    if (!configStore) {
      configStore = await buildConfigStore()
    }
    return configStore
  }

  const exitIfInvalid = async (strict: boolean = false) => {
    const configStore = await getConfigStore()
    if (!configStore.isValid(strict)) {
      log.error(
        colorize`Please initialize the program configuration {dim dev ${configStore.program} config init}`,
      )
      process.exit()
    }
  }

  const injectConfigCommands = (program: Command) => {
    const configCommand = program
      .command('config')
      .description('manage application configuration')

    // Initialize dev-command configuration based on the ConfigSchema
    configCommand
      .command('init')
      .description('initialize application configuration')
      .action(async () => {
        // use config to build a clack group of question
        introTitle(`Configure ${program.name()}`)

        const configStore = await buildConfigStore(homedir())

        // Render all global config prompts
        const prompts = await buildPrompts({ global: true })
        const result = await group(prompts, {
          onCancel() {
            cancel('Operation cancelled.')
            process.exit(0)
          },
        })

        const configFile = await configStore.saveConfig(result)
        outro(colorize`Configuration saved in {dim ${configFile}}`)
      })

    configCommand
      .command('override')
      .alias('set')
      .argument(
        '[name]',
        'The config to override, Leave empty for interactively pick configs',
      )
      .description('override application configuration')
      .action(async (name) => {
        introTitle(`Override configuration for ${program.name()}`)
        const configStore = await getConfigStore()

        await exitIfInvalid(true)

        const currentDir = process.cwd()
        const homeDir = homedir()

        // Make sure we are inside the homedir
        if (!currentDir.startsWith(homeDir) || currentDir === homeDir) {
          return exitWithError(
            'You can only override configurations in the subdirectories of your home folder',
          )
        }

        const currentOverrides = await configStore.getOverrides()
        if (currentOverrides) {
          log.info(
            `Current overrides: ${Object.keys(currentOverrides).join(', ')}`,
          )
        }

        let promptChoices: string[] = []
        if (name) {
          const config = configStore.configSchema[name]
          if (!config) {
            return exitWithError('Invalid config name')
          }
          promptChoices = [name]
        } else {
          // Pick what config to override
          const choices = await multiselect({
            message: 'Pick the configuration to override',
            options: Object.entries(configStore.configSchema).map(
              ([key, value]) => {
                return {
                  value: key,
                  label: value.label,
                  hint: value.description,
                }
              },
            ),
            initialValues: Object.keys(currentOverrides || {}),
          })

          if (isCancel(choices)) {
            return cancel('Operation cancelled.')
          }

          promptChoices = choices as string[]
        }

        const prompts = await buildPrompts({ only: promptChoices })
        const result = await group(prompts, {
          onCancel() {
            cancel('Operation cancelled.')
            process.exit(0)
          },
        })

        await tasks([
          {
            title: 'Saving overrides files',
            task: async () => {
              const file = await configStore.saveConfig(result)
              return colorize`Configuration saved in {dim ${file}}`
            },
          },
        ])

        outro()
      })

    // Clear command
    configCommand
      .command('clear')
      .description('clear all configuration files')
      .action(async () => {
        introTitle('Clear config')

        const config = await getConfigStore()

        const choice = await confirm({
          message: colorize`Are you sure you want to delete all configuration files ? {bold.yellow This cannot be undone}`,
        })

        if (choice == true) {
          await tasks([
            {
              title: 'Clearing config files',
              task: async () => {
                await config.clearFiles()
              },
            },
          ])

          outro('Config files removed')
        } else {
          cancel('Operation cancelled.')
        }
      })

    // Debug Command
    configCommand
      .command('debug')
      .description('display current configuration')
      .action(async () => {
        introTitle('Debugging config')

        const config = await getConfigStore()
        const all = await config.getConfigs()

        const overridePaths = Object.entries(all).map(([path, config]) => {
          if (config !== null) {
            return colorize`{dim.green \u2714} ${path}`
          } else {
            return colorize`{dim {red \u2716} ${path}}`
          }
        })

        log.info(
          colorize`Config directory located: {dim ${config.getRootDir()}}`,
        )
        log.info('Overrides:\n ' + overridePaths.join('\n '))

        note(
          JSON.stringify(await config.getAll(), null, 2),
          `Configuration Values:`,
        )
      })
  }

  const buildPrompts = async <T extends ConfigSchema>({
    only = [],
    global = false,
  }: {
    only?: (keyof T)[]
    global?: boolean
  } = {}) => {
    const configStore = await getConfigStore()
    const prompts: any = {}

    for (const key of Object.keys(configSchema)) {
      if (only.length > 0 && !only.includes(key)) {
        continue
      }

      const configSetting = configSchema[key]

      if (global === true && configSetting['global'] !== true) {
        continue
      }

      prompts[key] = async () => {
        let message = configSetting.label
        if (configSetting.description) {
          message += ` ${colorize`{dim (${configSetting.description})}`}`
        }
        if (configSetting.secret) {
          message += ` ${colorize`{yellow Secret}`}`
        }

        // Todo if options specified use select, if default value is array use multiselect
        return text({
          message,
          initialValue: await configStore.get(key),
          // Require value
          validate(value) {
            if (configSetting.required && (value || '').length === 0)
              return `Value is required!`
          },
        })
      }
    }

    return prompts
  }

  async function getConfig(key: keyof TSchema & string) {
    const store = await getConfigStore()
    return store.get(key)
  }

  return { getConfig, getConfigStore, exitIfInvalid, injectConfigCommands }
}
