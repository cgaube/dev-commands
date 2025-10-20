import { devCliProgram } from '#common/devCliProgram'
import { injectConfigCommands } from './config'

const linear = devCliProgram({
  name: 'linear',
  summary: 'Linear related dev commands',
})

injectConfigCommands(linear)

// Sub commands
linear
  .command('start')
  .alias('branch')
  .description('Start a git branch based on a linear issue')
  .action(async () => {})

linear.parse()
