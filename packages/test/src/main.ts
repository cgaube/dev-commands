import { devCliProgram } from '#common/devCliProgram'

const program = devCliProgram({ name: 'test', summary: 'Test Command' })

// Sub commands
program
  .command('ping')
  .description('Test ping')
  .action(() => {
    console.log('pong')
  })

program
  .command('other')
  .description('other')
  .action(() => {
    console.log('other')
  })

program.parse()
