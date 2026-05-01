import setupProgramConfiguration from '#common/config'
import type { ConfigSchema } from '#common/config/types'

const config: ConfigSchema = {
  apiKey: {
    label: 'Api Key',
    description: 'Api key to access linear GraphQL api',
    secret: true,
    required: true,
    global: true,
  },
}

export const { getConfig, injectConfigCommands, exitIfInvalid } =
  setupProgramConfiguration('linear', config)
