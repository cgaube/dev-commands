import { execaSync } from 'execa'
import { select, multiselect } from '@clack/prompts'
import { picocolors, pill } from '#common/style'

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
    const [branchName, sha, subject, author, date, selected] = b
      .trim()
      .split(' || ')

    const formattedDate = date.match(/\(([^)]*)\)/)![1]

    const workInProgress = subject.toLowerCase().includes('wip')

    const text = [
      picocolors.yellow(branchName),
      picocolors.red(sha),
      subject,
      picocolors.blue(author),
      picocolors.dim(picocolors.green(`(${formattedDate})`)),
      // Tags
      selected ? pill('current', 'cyan') : null,
      workInProgress ? pill('WIP', 'yellow') : null,
    ].filter((n) => n)

    return {
      value: branchName,
      label: text.join(picocolors.dim(' • ')),
    }
  })

  if (multi) {
    return await select({
      message: 'Select a branch',
      options: branches,
    })
  } else {
    return await multiselect({
      message: 'Select branches',
      options: branches,
    })
  }
}

export { getCurrentBranch, getBranches, branchesChoices }
