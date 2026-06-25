# @devcommands/git

Git-related dev commands with interactive prompts and AI-assisted commits.

## Install

```bash
dev packages install git
```

## Usage

```bash
git <subcommand> [options]
```

## Commands

### `checkout` (alias: `switch`)

Interactively pick a branch and check it out.

### `cleanup`

Multi-select local branches and delete them in one pass.

### `commit`

Generate a commit message with AI from the staged diff, then commit.

### `review`

Review your local changes with AI before pushing.

### `pr`

Check out the branch of a GitHub pull request.

### `stack`

A Graphite-style stacked-branch workflow. Running `stack` with no subcommand
opens a full-screen TUI (built with Ink) showing your stack as a tree.

**TUI keybindings:**

| Key              | Action                                       |
| ---------------- | -------------------------------------------- |
| `↑`/`↓`(`k`/`j`) | move the cursor                              |
| `enter` / `c`    | check out the selected branch                |
| `tab` / `⇧tab`   | cycle the right panel tab (forward / back)   |
| `i` / `l` / `d`  | jump straight to a tab (Info / Log / Diff)   |
| `o`              | open the selected branch's PR in the browser |
| `r`              | restack — rebase the stack onto its parents  |
| `s`              | sync — reparent merged branches and clean up |
| `R`              | refresh — re-read the stack and PR cache     |
| `q` / `esc`      | quit                                         |

The right panel is a tabbed view: **Info** (branch summary), **Log**
(`git log --oneline` vs parent) and **Diff** (vs parent), switched with the
`i`/`l`/`d` shortcuts shown in the tab strip. The Info tab shows the associated
GitHub PR (number, state, title) when one exists — looked up via `gh`, so it's a
no-op if `gh` isn't installed or authenticated.

**Subcommands** (non-interactive, scriptable):

- `stack create <name>` — branch off the current branch and record the parent.
- `stack track` (alias `adopt`) — record a parent for the current branch.
- `stack restack` — rebase every tracked branch onto its parent's current tip.
- `stack sync` — detect branches merged into trunk, lift their children onto the
  surviving parent, restack, and delete the merged local branches.
- `stack log` — print the stack tree.

**How it works.** Branch relationships are stored as a single JSON document at
`.git/devstack.json` (per-repo, never committed — anything under `.git/` is
outside the working tree, so no `.gitignore` entry is needed). Each tracked
branch records its `parent` and the parent's tip sha at branch/restack time.
That recorded sha lets restacks replay only a branch's own commits
(`git rebase --onto`), which is what makes restacking conflict-free and lets
`sync` cleanly drop the commits of a branch that was squash-merged into trunk.

Merge detection is pure git (no GitHub dependency): a branch counts as merged
when its commits are already contained in trunk, or when merging it into trunk
would produce trunk's exact tree (the squash-merge case).

**Fork-point correction.** The recorded `parentSha` can become stale — for
example when a restack hits a conflict and the user resolves it with
`git rebase --continue`, when the branch is rebased manually outside the tool,
or when the parent branch is amended. A stale `parentSha` produces a rebase
range that is too wide, replaying commits that already exist on the parent and
causing repeat conflicts.

Before each rebase, restack picks the best exclusion point (base). The first
check is a fast path: if `parentTip === parentSha`, the parent hasn't moved and
the branch is skipped with no git overhead. Otherwise:

| Scenario                                  | inBranch | inParent | Base chosen                | Why                                        |
| ----------------------------------------- | -------- | -------- | -------------------------- | ------------------------------------------ |
| Parent got new commits                    | true     | true     | `fork-point` (= parentSha) | No change needed — same value              |
| Stale (conflict recovery, manual rebase)  | true     | true     | `fork-point` (corrected)   | Finds the true split point                 |
| Parent amended (valid parentSha)          | true     | false    | `parentSha`                | Correctly excludes old parent tip          |
| Parent amended (orphaned parentSha)       | false    | false    | `fork-point` via reflog    | Only the reflog knows the pre-amend fork   |
| Orphaned (parent force-pushed, no reflog) | false    | false    | `merge-base`               | Last-resort common ancestor                |
| Squash/rebase merge to trunk              | true     | false    | `parentSha`                | Only correct value — merge-base is too old |

When `parentSha` is in the branch's history but NOT the parent's, the parent's
history was rewritten (amend, squash merge, or rebase merge). `parentSha` is the
only correct boundary in this case. Otherwise the base is computed: `fork-point`
(reflog-aware) then `merge-base` (plain ancestor) then `parentSha` (last
resort).

## Requirements

- `pr` requires the [`gh`](https://cli.github.com/) CLI to be installed and
  authenticated.
- `commit` and `review` require an AI provider CLI (defaults to `claude`).
