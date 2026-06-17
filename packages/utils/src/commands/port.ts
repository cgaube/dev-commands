import { Command } from 'commander'
import { log, outro } from '@clack/prompts'
import { execa } from 'execa'
import { introTitle } from '#common/style'

export function createPortCommand() {
  return new Command('port')
    .description('lists applications listening on a specific port')
    .argument('<port>', 'The port number to listen to')
    .action(async (port) => {
      introTitle('Port Listeners')

      try {
        const { stdout } = await execa('lsof', [
          '-i',
          `:${port}`,
          '-s',
          'TCP:LISTEN',
        ])
        log.info(stdout as string)
      } catch {
        log.warning('No processes are listening on this port.')
      }
      outro()
    })
}
