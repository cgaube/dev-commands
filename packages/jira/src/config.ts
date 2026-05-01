import setupProgramConfiguration from '#common/config'
import { ConfigSchema } from '#common/config/types'

const config = {
  host: {
    label: 'Host',
    description: 'Atlassian Cloud host (e.g. acme.atlassian.net)',
    required: true,
    global: true,
  },
  email: {
    label: 'Email',
    description: 'Atlassian account email',
    required: true,
    global: true,
  },
  apiToken: {
    label: 'API token',
    description:
      'API token from id.atlassian.com (https://id.atlassian.com/manage-profile/security/api-tokens)',
    secret: true,
    required: true,
    global: true,
  },
} satisfies ConfigSchema

export const { getConfig, injectConfigCommands, exitIfInvalid } =
  setupProgramConfiguration('jira', config)
