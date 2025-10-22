export type ConfigValue = {
  label: string
  defaultValue?: string
  description?: string
  options?: Array<string>
  secret?: boolean
  required?: boolean
  global?: boolean // Set to "false" to only be used in a subdirectories
}

export type ConfigSchema = Record<string, ConfigValue>
