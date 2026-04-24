import { createCheckoutCommand } from './checkout'
import { createCleanupCommand } from './cleanup'
import { createCommitCommand } from './commit'
import { createPrCommand } from './pr'

export const commands = [
  createCheckoutCommand,
  createPrCommand,
  createCleanupCommand,
  createCommitCommand,
]
