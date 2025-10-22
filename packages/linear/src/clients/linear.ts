import { LinearClient } from '@linear/sdk'
import { getConfig } from '#src/config'

export const getClient = async (): Promise<LinearClient> => {
  return new LinearClient({
    apiKey: await getConfig('apiKey'),
  })
}

export const linearViewer = async () => {
  const linearClient = await getClient()
  return await linearClient.viewer
}
