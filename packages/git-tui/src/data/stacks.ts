// Read the list of stacks that `gh stack` keeps.
//
// `gh stack view --json` shows only the stack of the current branch. To show
// all the stacks, read `.git/gh-stack`. Its format is not documented, so read
// only the stack order and the PR numbers. Get all other data from git and gh.

const STACK_FILE = 'gh-stack'
const SUPPORTED_SCHEMA_VERSION = 1

type FileBranch = {
  branch: string
  pullRequest?: { number: number; merged?: boolean }
}

type FileStack = {
  number?: number
  trunk: { branch: string }
  branches: FileBranch[]
}

export type Stack = {
  // The stack number on GitHub. Null until the first submit.
  number: number | null
  trunk: string
  // The branches from the bottom (next to the trunk) to the top.
  branches: { name: string; prNumber: number | null; merged: boolean }[]
}

export async function readStacks(gitDir: string): Promise<Stack[]> {
  const file = Bun.file(`${gitDir}/${STACK_FILE}`)
  if (!(await file.exists())) return []
  const data = (await file.json()) as {
    schemaVersion: number
    stacks?: FileStack[]
  }
  if (data.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `.git/${STACK_FILE} has schema version ${data.schemaVersion}. This tool reads only version ${SUPPORTED_SCHEMA_VERSION}.`,
    )
  }
  return (data.stacks ?? []).map((s) => ({
    number: s.number ?? null,
    trunk: s.trunk.branch,
    branches: s.branches.map((b) => ({
      name: b.branch,
      prNumber: b.pullRequest?.number ?? null,
      merged: !!b.pullRequest?.merged,
    })),
  }))
}
