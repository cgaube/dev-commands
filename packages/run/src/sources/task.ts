import { dirname } from 'node:path'
import { execa } from 'execa'
import { findUp } from '#src/utils/findUp'
import type { DiscoveryResult, ScriptEntry } from './index'

type TaskEntry = {
  name: string
  desc?: string
  summary?: string
}

type TaskList = {
  tasks: TaskEntry[]
}

export async function discoverTask(cwd: string): Promise<DiscoveryResult> {
  const file = findUp(['Taskfile.yml', 'Taskfile.yaml'], cwd)
  if (!file) return { scripts: [], warnings: [] }

  if (!Bun.which('task')) {
    return {
      scripts: [],
      warnings: [`Found ${file} but "task" is not installed; skipping.`],
    }
  }

  const dir = dirname(file)

  let list: TaskList
  try {
    const { stdout } = await execa('task', [
      '--taskfile',
      file,
      '--list-all',
      '--json',
    ])
    list = JSON.parse(stdout)
  } catch {
    return {
      scripts: [],
      warnings: [`Could not read tasks from ${file}.`],
    }
  }

  const scripts: ScriptEntry[] = (list.tasks ?? []).map((t) => ({
    source: 'task',
    name: t.name,
    command: ['task', t.name],
    cwd: dir,
    description: t.desc || t.summary || undefined,
  }))

  return { scripts, warnings: [] }
}
