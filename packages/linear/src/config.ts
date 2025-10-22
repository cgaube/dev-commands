import setupProgramConfiguration from '#common/config'
import { ConfigSchema } from '#common/config/types'

const config = {
  apiKey: {
    label: 'Api Key',
    description: 'Api key to access linear GraphQL api',
    secret: true,
    required: true,
    global: true,
  },
} satisfies ConfigSchema

export const { getConfig, injectConfigCommands, exitIfInvalid } =
  setupProgramConfiguration('linear', config)
