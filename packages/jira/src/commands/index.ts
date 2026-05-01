import { createListCommand } from './list'
import { createStartCommand } from './start'
import { createWhoamiCommand } from './whoami'

export const commands = [
  createListCommand,
  createStartCommand,
  createWhoamiCommand,
]
