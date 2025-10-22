import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { secrets, file } from 'bun'
import { join } from 'path'
import { homedir } from 'os'
import { ConfigSchema } from './types'
import { createHash } from 'crypto'
import { readdir, rm } from 'node:fs/promises'

type ConfigValue = any
type ConfigData = Record<string, ConfigValue>

export class ConfigStore {
  public readonly program: string
  public readonly configSchema: ConfigSchema
  private readonly allConfigDir: string
  private readonly configDir: string
  private readonly data: ConfigData = {}

  constructor(
    program: string,
    dir: string = process.cwd(),
    configSchema: ConfigSchema = {},
  ) {
    this.allConfigDir = join(homedir(), '.devcommands-config', program)
    this.configDir = dir
    this.program = program

    this.configSchema = configSchema
    this.setDefaults()
  }

  // Make sure the configuration store has all the required values
  isValid(strict: boolean = false) {
    if (strict && !existsSync(this.allConfigDir)) {
      return false
    }

    for (const [key, value] of Object.entries(this.configSchema)) {
      if (value.required && !this.data[key]) {
        return false // exits the method immediately
      }
    }

    return true
  }

  // Load configuration from the file system
  // @note we use shallow merge strategy
  async loadData() {
    const all = await this.getConfigs()
    Object.values(all).forEach((config) => {
      if (config !== null) {
        // Shallow merge with parent
        Object.assign(this.data, config)
      }
    })
  }

  // Get all configs per getConfigPaths
  async getConfigs(): Promise<Record<string, ConfigData | null>> {
    const values = await Promise.all(
      this.getConfigPaths()
        .reverse()
        .map(async (dir) => {
          const configFile = this.configFileForDir(dir)
          const jsonContent = (await configFile.exists())
            ? await configFile.json()
            : null
          return [dir, jsonContent]
        }),
    )

    return Object.fromEntries(values)
  }

  async getAll(): Promise<ConfigData> {
    const entries = await Promise.all(
      Object.keys(this.data).map(async (k) => [k, await this.get(k)]),
    )

    return Object.fromEntries(entries)
  }

  async get(key: string) {
    const originalValue = this.data[key]

    if (originalValue && originalValue.type === 'secret') {
      return await secrets.get({
        service: originalValue.service,
        name: originalValue.name,
      })
    }

    return originalValue
  }

  async getOverrides() {
    const all = await this.getConfigs()
    return all[this.configDir]
  }
  /**
   * Clear all the files and their secrets
   * - need to fetch all configs so we can delete the secrets
   * - then we just delete the directory
   */
  async clearFiles() {
    const allConfigs = await this.getProgramConfigs()

    allConfigs.forEach((configs) => {
      Object.values(configs).map(async (value) => {
        if (this.isSecret(value)) {
          return await secrets.delete(value)
        }
      })
    })

    // Recursively delete folder
    await rm(this.allConfigDir, { recursive: true, force: true })
  }

  async saveConfig(values: ConfigData) {
    const folderFile = this.configFileForDir(this.configDir)

    const normalized = await this.normalizeValues(values)

    await folderFile.write(
      JSON.stringify(Object.fromEntries(normalized), null, 2),
    )
    return folderFile.name
  }

  // Privates Methods
  // -------------------

  // Traverse all directories up to home folder to find config paths
  private getConfigPaths() {
    const paths = []
    let currentPath = this.configDir

    while (currentPath !== dirname(homedir())) {
      paths.push(currentPath)
      currentPath = dirname(currentPath)
    }

    return paths
  }

  private configFileForDir(dir: string) {
    return file(join(this.allConfigDir, `${this.hashPath(dir)}.json`))
  }

  // Loop values to set secret based on configSchema
  private async normalizeValues(values: ConfigData) {
    return Promise.all(
      Object.entries(values).map(async ([key, value]) => [
        key,
        this.configSchema[key].secret
          ? await this.setSecret(key, value)
          : value,
      ]),
    )
  }

  private async setSecret(name: string, value: string) {
    const secret = {
      type: 'secret',
      service: `devcommand-${this.program}`,
      name: `${this.hashPath(this.configDir)}-${name}`,
    }

    await secrets.set({
      ...secret,
      value,
    })

    return secret
  }

  private setDefaults() {
    const defaultValues: any = {}
    for (const [configName, configSetting] of Object.entries(
      this.configSchema,
    )) {
      if (configSetting.defaultValue) {
        defaultValues[configName] = configSetting.defaultValue
      }
    }
    Object.assign(this.data, defaultValues)
  }

  private isSecret(value: ConfigValue) {
    return value.type === 'secret'
  }

  private hashPath = (path: string) => {
    return createHash('sha1').update(path).digest('hex')
  }

  // Return ALL configuration values for the entire program (not folder specific)
  private async getProgramConfigs(): Promise<ConfigData[]> {
    if (!existsSync(this.allConfigDir)) {
      return []
    }

    const allFiles = await readdir(this.allConfigDir, { recursive: false })
    const jsonFiles = allFiles.filter((f) => f.endsWith('.json'))

    const values: ConfigData[] = await Promise.all(
      jsonFiles.map(async (fileName) => {
        const jsonContent = await file(join(this.allConfigDir, fileName)).json()
        return jsonContent
      }),
    )
    return values
  }
}
