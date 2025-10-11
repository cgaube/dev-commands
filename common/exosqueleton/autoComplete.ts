import type { Command } from 'commander'

const directives = {
  default: ':0',
  error: ':1',
  noSpace: ':2',
  noFileComp: ':4',
  filterFileExt: ':8',
  filterDirs: ':16',
}

// Get all the commands that match the userInput
// @see https://github.com/square/exoskeleton/tree/main/pkg/shellcomp#directives
// The function should write a list of suggestions to standard output (separated by newlines) and a directive
// 0 	DirectiveDefault The shell should perform its default behavior after providing the returned completions
// 1 	DirectiveError The shell should ignore completions: an error occurred
// 2 	DirectiveNoSpace The shell should not add a space after completing a word (useful for completing arguments to flags that end with =)
// 4 	DirectiveNoFileComp The shell should not suggest files from the working directory
// 8 	DirectiveFilterFileExt The shell should suggest files from the working directory and use the returned completions as file extension filters instead of suggestions
// 16 DirectiveFilterDirs The shell should suggest directories and use the returned completions to identify the directory in which to search
export function autoComplete(program: Command, userInput: string[]) {
  const toSearch = userInput.join(' ')
  const matches = program.commands
    .map((subCommand) => subCommand.name())
    .filter((match) => match.startsWith(toSearch))

  matches.push(directives['noFileComp'])

  // Display separated by new lines
  console.log(matches.join('\n'))
}
