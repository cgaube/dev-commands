# @devcommands/git-stack

A full-screen TUI for stacked pull requests. It uses the native GitHub
[`gh stack`](https://github.com/github/gh-stack) extension.

This package does not keep stack data of its own. It reads the stacks that
`gh stack` records in `.git/gh-stack`, and it runs `gh stack` commands for all
changes. Thus you can use `gh stack` directly and this TUI together.

For the older tree-based stack that this repo tracks itself, see `dev git stack`
in [`@devcommands/git`](../git).

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`), logged in.
- The `gh stack` extension, version 0.1.1 or later:

  ```bash
  gh extension install github/gh-stack
  ```

The TUI stops with an install hint when the extension is missing. It shows a
warning when the version is older than 0.1.1.

## Install

```bash
dev packages install git-stack
```

## Usage

```bash
dev git-stack        # open the TUI
dev git-stack log    # print all local stacks
```

## Workflow

| When                        | Key                  |
| --------------------------- | -------------------- |
| start a stack from `main`   | `n`                  |
| add a branch to a stack     | `n`                  |
| push the stack and open PRs | `P`                  |
| a PR was merged on GitHub   | `S`                  |
| `main` changed              | `S`, or `r` then `P` |

**Merge on GitHub only.** The TUI does not merge PRs. With `gh stack`, only the
bottom PR can merge into `main`. To merge a PR higher in the stack, GitHub
merges it and all the PRs below it to `main` in one operation.

**After a merge on GitHub:** press `S`. Do not delete the local branches before
the sync. Sync does these steps:

1. It fetches, and fast-forwards `main` to `origin/main`.
2. It gets the PR state from GitHub.
3. It rebases the open branches onto `main`, and force-pushes them.
4. It deletes the local branches of merged PRs (`--prune`).

When all the PRs of a stack are merged, `S` also removes the stack from local
tracking (`gh stack unstack --local`). The stack stays on GitHub.

**Rebase without a push:** `r` fetches `main` and rebases the stack onto it.
Nothing is pushed. Check the result, then press `P` to push.

**Conflicts:** when sync finds a conflict, it stops and restores the branches.
When `r` finds a conflict, it stops in the middle of the rebase. In both cases,
resolve the conflict in a terminal:

```bash
gh stack rebase             # stops at the conflict
git add <files>             # after you edit the files
gh stack rebase --continue  # or: gh stack rebase --abort
```

While a rebase is in progress, the TUI does not change the stacks.

## Commands

### (no subcommand)

Open the TUI. It shows all local stacks as a tree. Each trunk shows one time,
and its stacks hang below it:

```text
⌂ main
  ○ a  stack #12
    ○ b
  ○ c
    ○ d
```

Each `gh stack` stack is linear. To get more branches from `main`, make more
stacks on `main`.

`gh stack` commands act on the stack of the current branch. Thus, before a stack
command runs, the TUI checks out the selected branch.

**Keys on a trunk row** (they act on all the stacks of the trunk):

| Key | Action                                                     |
| --- | ---------------------------------------------------------- |
| `n` | start a new stack on this trunk (`gh stack init --base`)   |
| `r` | rebase all the stacks, one after the other, without a push |
| `S` | sync all the stacks, one after the other                   |

**Keys on a branch row** (they act on the stack of the branch):

| Key | Action                                                     |
| --- | ---------------------------------------------------------- |
| `n` | add a branch on top of the stack (`gh stack add`)          |
| `P` | push and open the PRs as drafts (`gh stack submit --auto`) |
| `r` | rebase the stack without a push (`gh stack rebase`)        |
| `S` | sync the stack (`gh stack sync --prune`)                   |
| `o` | open the PR of the branch in the browser                   |

**Other keys:**

| Key               | Action                                  |
| ----------------- | --------------------------------------- |
| `↑`/`↓` (`k`/`j`) | move the cursor                         |
| `enter` / `c`     | check out the selected branch           |
| `tab` / `⇧tab`    | go to the next / previous tab           |
| `i` / `l`         | show the Info / Log tab                 |
| `N`               | start a new stack on the default branch |
| `R`               | reload the stacks and the PR status     |
| `?`               | show the help                           |
| `q` / `esc`       | quit                                    |

The tree does not show a merged branch that is deleted locally.

**Other people's commits:** `S` and `P` force-push, as `gh stack` does. When
someone else pushed to your PR branch, get their commits first, or the push
deletes them.

All the commands run without a terminal, so `gh stack` does not show prompts.
For example, when `sync` finds that the local and remote stacks are different,
it stops. Run `gh stack sync` in a terminal to select what to do.

**Badges:**

| Badge       | Meaning                                   |
| ----------- | ----------------------------------------- |
| `●`         | the current branch                        |
| `⌂`         | the trunk                                 |
| `+N`        | commits after the parent                  |
| `⚠`         | the parent has moved, use `r` or `S`      |
| `merged`    | the PR is merged                          |
| `⇡⇣`        | the local and remote branch are different |
| `*`         | changes that are not committed            |
| `[gone]`    | the branch does not exist locally         |
| `●` (color) | CI status: green, red or yellow           |
| `✓` / `✗`   | PR approved / changes requested           |

The TUI reloads when branches, `HEAD` or `.git/gh-stack` change.

### `log`

Print the tree of local stacks without the TUI.

## Limits

- The TUI does not merge PRs. Merge on GitHub.
- The TUI does not resolve conflicts. Use `gh stack rebase` in a terminal.
- `gh stack` stacks are linear. A branch has one parent and one child. To put a
  branch in the middle of a stack, use `gh stack modify` in a terminal.
- The format of `.git/gh-stack` is not documented. The TUI reads schema version
  1 only, and stops with an error for a newer version.
