import type { ConfigSchema } from '#common/config/types'
import setupProgramConfiguration from '#common/config'

const config: ConfigSchema = {
  api_key: {
    label: 'Api Key',
    description: 'Api key to access linear GraphQL api',
    secret: true,
    required: true,
  },
  test: {
    label: 'Other config',
  },
  default_val: {
    label: 'Default',
    defaultValue: 'default value',
  },
}

export const { configStore, exitIfInvalid, injectConfigCommands } =
  await setupProgramConfiguration('linear', config)
