import { createCheckoutCommand } from './checkout'
import { createCleanupCommand } from './cleanup'
import { createCommitCommand } from './commit'
import { createPrCommand } from './pr'
import { createReviewCommand } from './review'
import { createStackCommand } from './stack'

export const commands = [
  createCheckoutCommand,
  createPrCommand,
  createCleanupCommand,
  createCommitCommand,
  createReviewCommand,
  createStackCommand,
]
