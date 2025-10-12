import { execaSync } from 'execa'
import { select, multiselect } from '@clack/prompts'
import { picocolors } from '#common/style'

const getCurrentBranch = () => {
  return execaSync('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim()
}

const getBranches = () => {
  const { stdout } = execaSync('git', [
    'for-each-ref',
    '--sort=-committerdate',
    'refs/heads/',
    '--format=%(refname:short) || %(objectname:short) || %(contents:subject) || %(authorname) || (%(committerdate:relative)) || %(HEAD)',
  ])

  return stdout.split('\n').filter((line) => line.trim() !== '')
}

async function branchesChoices(multi: true): Promise<string[] | symbol>
async function branchesChoices(multi?: false): Promise<string | symbol>
async function branchesChoices(multi = false) {
  const branches = getBranches().map((b) => {
    const [branchName, sha, subject, author, date, current] = b
      .trim()
      .split(' || ')

    const formattedDate = date.match(/\(([^)]*)\)/)![1]

    const workInProgress = subject.toLowerCase().includes('wip')

    const text = [
      picocolors.yellow(branchName),
      picocolors.red(sha),
      subject,
      picocolors.blue(author),
      picocolors.green(`(${formattedDate})`),
      // Tags
      [
        current ? picocolors.cyan('[current]') : null,
        workInProgress ? picocolors.magenta('[WIP]') : null,
      ]
        .filter((n) => n)
        .join(' '),
    ].filter((n) => n)

    return {
      value: branchName,
      label: text.join(picocolors.dim(' • ')),
    }
  })

  if (multi) {
    return await multiselect({
      message: 'Select branches',
      options: branches,
    })
  } else {
    return await select({
      message: 'Select a branch',
      options: branches,
    })
  }
}

export { getCurrentBranch, getBranches, branchesChoices }
