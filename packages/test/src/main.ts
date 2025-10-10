import { Command } from 'commander'

const program = new Command()

program.name('test').description('test utilities').version('1.0.0')

program
  .command('ping')
  .description('Test ping')
  .action(() => {
    console.log('pong')
  })

program.parse()
