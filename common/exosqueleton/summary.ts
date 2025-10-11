import type { Command } from 'commander'

export function summary(program: Command) {
  console.log(program.summary())
}
