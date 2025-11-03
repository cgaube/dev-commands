import { existsSync } from 'node:fs'
import { secrets, file } from 'bun'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { ConfigSchema } from './types'
import { createHash } from 'crypto'
import { readdir, rm } from 'node:fs/promises'

type ConfigValue = any
type ConfigData = Record<string, ConfigValue>

export class ConfigStore {
  public readonly program: string
  public readonly configSchema: ConfigSchema
  private readonly rootDir: string
  private readonly configDir: string
  private readonly data: ConfigData = {}

  // Async factory to load all configs files
  static async create(
    program: string,
    dir: string = process.cwd(),
    configSchema: ConfigSchema = {},
  ) {
    const instance = new ConfigStore(program, dir, configSchema)
    await instance.loadData()
    return instance
  }

  private constructor(
    program: string,
    dir: string = process.cwd(),
    configSchema: ConfigSchema = {},
  ) {
    this.rootDir = join(
      process.env.HOMEBREW_PREFIX || '/opt/homebrew',
      'etc',
      'devcommands-config',
      program,
    )
    this.configDir = dir
    this.program = program

    this.configSchema = configSchema
    this.setDefaults()
  }

  getRootDir(): string {
    return this.rootDir
  }

  // Make sure the configuration store has all the required values
  isValid(strict: boolean = false) {
    if (strict && !existsSync(this.rootDir)) {
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
   * Clear all override stored in the current configuration directory.
   * This method deletes the configuration file specific to the current
   * directory, effectively removing any overrides set for it.
   */
  async clearOverrideFile() {
    const folderFile = this.configFileForDir(this.configDir)

    if (await folderFile.exists()) {
      return folderFile.delete()
    }
  }

  /**
   * Clears all configuration files and their associated secrets for the program.
   * It fetches all configurations to identify and delete any stored secrets
   * before removing the configuration directory itself.
   */
  async clearAllProgramFiles() {
    const files = await this.getAllProgramConfigsFiles()

    // Delete all secrets associated with each file
    await Promise.all(files.map((filePath) => this.clearFile(filePath)))

    // Recursively delete folder
    await rm(this.rootDir, { recursive: true, force: true })
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
    return file(join(this.rootDir, `${this.hashPath(dir)}.json`))
  }

  /**
   * Loop values to set secret based on configSchema
   */
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

  private async deleteSecret(value: ConfigValue) {
    if (this.isSecret(value)) {
      return await secrets.delete(value)
    }
  }

  private hashPath = (path: string) => {
    return createHash('sha1').update(path).digest('hex')
  }

  /**
   * Clear one file
   * This also mean deleting all secrets associated with the keys in the file as well
   */
  private async clearFile(filePath: string): Promise<void> {
    const jsonContent: Record<string, ConfigValue> = await file(filePath).json()
    await Promise.all(
      Object.values(jsonContent).map((value) => this.deleteSecret(value)),
    )
  }

  /**
   * Fetch all the json config files for the current program
   */
  private async getAllProgramConfigsFiles() {
    if (!existsSync(this.rootDir)) {
      return []
    }

    const allFiles = await readdir(this.rootDir, { recursive: false })
    return allFiles
      .filter((f) => f.endsWith('.json'))
      .map((filePath) => join(this.rootDir, filePath))
  }
}
