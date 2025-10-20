export type ConfigValue = {
  label: string
  defaultValue?: string
  description?: string
  options?: Array<string>
  secret?: boolean
  required?: boolean
}

export type ConfigSchema = Record<string, ConfigValue>
