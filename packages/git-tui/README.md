# @devcommands/git-tui

A full-screen TUI for all your local branches. It shows two kinds of branches:

- **Stack branches**: the branches of stacked pull requests. They use the native
  GitHub [`gh stack`](https://github.com/github/gh-stack) extension, and get all
  the stack actions.
- **Normal branches**: all the other local branches. Their parent is always the
  default branch (usually `main`), also when you made them from another branch.
  They get a small set of actions: check out, push and open a PR, open the PR,
  make a stack, and delete.

This package does not keep stack data of its own. It reads the stacks that
`gh stack` records in `.git/gh-stack`, and it runs `gh stack` commands for all
changes. Thus you can use `gh stack` directly and this TUI together.

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
dev packages install git-tui
```

## Usage

```bash
dev git-tui        # open the TUI
dev git-tui log    # print all local branches
```

## Workflow

| When                        | Key                   |
| --------------------------- | --------------------- |
| start work from `main`      | `n` on `main`, or `N` |
| make a branch a stack       | `n` on the branch     |
| add a branch to a stack     | `n`                   |
| push the stack and open PRs | `P`                   |
| open PRs up to one branch   | `p`                   |
| a PR was merged on GitHub   | `S`                   |
| `main` changed              | `S`, or `r` then `P`  |

**Merge on GitHub only.** The TUI does not merge PRs. With `gh stack`, only the
PR of the first branch can merge into `main`. To merge a PR later in the stack,
GitHub merges it and all the PRs before it to `main` in one operation.

**After a merge on GitHub:** press `S`. Do not delete the local branches before
the sync. Sync does these steps:

1. It fetches, and fast-forwards `main` to `origin/main`.
2. It gets the PR state from GitHub.
3. It rebases the open branches onto `main`, and force-pushes them.
4. It deletes the local branches of merged PRs (`--prune`).

When all the PRs of a stack are merged, `S` also removes the stack from local
tracking (`gh stack unstack --local`). The stack stays on GitHub.

`S` also removes a stack that is not on GitHub and has no local branches. This
can occur when a tool deletes merged branches: a branch without commits looks
merged into `main`.

**Open PRs for part of a stack:** `p` on a branch opens PRs from the first
branch of the stack up to that branch. The branches after it get no PR. For
example, with `main → a → b → c`, press `p` on `b` to open PRs for `a` and `b`
only:

1. It pushes all the branches of the stack (`gh stack push`), `c` also.
2. It runs `gh stack link --base main a b`. This opens the missing PRs as
   drafts, and makes a stack of them on GitHub.

`c` stays in the local stack, so `r` and `S` still rebase it. Until the next
`P`, the stack label shows `local`, because `gh stack link` does not change the
local stack data. When `c` is ready, press `P`: it opens the PR of `c` and adds
it to the same stack on GitHub.

**Rebase without a push:** `r` fetches `main` and rebases the stack onto it.
Nothing is pushed. Check the result, then press `P` to push.

**Conflicts:** when sync finds a conflict, it stops and restores the branches.
Press `r` to rebase: it stops in the middle of the rebase, at the conflict.
Then:

1. Edit the files with the conflict.
2. Mark them as resolved: `git add <files>`.
3. Press `r` again. It continues the rebase (`gh stack rebase --continue`) and
   keeps the commit messages. When there is another conflict, it stops again.
4. When the rebase is done, press `P` to push.

While a rebase is in progress, the other stack keys do nothing. To stop the
rebase and restore the branches, run `gh stack rebase --abort` in a terminal.

## Commands

### (no subcommand)

Open the TUI. It shows all local branches as a tree. Each trunk shows one time,
and its stacks hang below it. The normal branches hang below the default branch,
after its stacks:

```text
⌂ main
  ○ ≡ a  stack #12
    ○ b
  ○ ≡ c
    ○ d
  ○ fix-typo
  ○ spike
```

The default branch is the branch that `origin/HEAD` names. Without
`origin/HEAD`, it is `main`, or `master` when only `master` exists.

**First and last branch:** the first branch of a stack is the one closest to the
trunk (`a` above). The last branch is the one furthest from it (`b`). The
`gh stack` docs call them the "bottom" and the "top" of the stack, which is the
opposite of how the tree shows them.

`n` on any branch of a stack adds the new branch after the last branch.
`gh stack` can only add there. The prompt shows the branch it comes after.

Each `gh stack` stack is linear. To get more branches from `main`, make normal
branches, or more stacks on `main`.

`gh stack` commands act on the stack of the current branch. Thus, before a stack
command runs, the TUI checks out the selected branch.

**Keys on a trunk row** (`r` and `S` act on all the stacks of the trunk):

| Key | Action                                                     |
| --- | ---------------------------------------------------------- |
| `n` | start a normal branch from this trunk (`git switch -c`)    |
| `r` | rebase all the stacks, one after the other, without a push |
| `S` | update the trunk, then sync all the stacks                 |

`S` on a trunk first fetches it and fast-forwards it to `origin`, also when
there are no stacks, e.g. after you merge the PR of a normal branch on GitHub.
It does not force: when the trunk has local commits that `origin` does not have,
it shows `main has local commits — not updated`.

**Keys on a stack branch** (they act on the stack of the branch):

| Key | Action                                                     |
| --- | ---------------------------------------------------------- |
| `n` | add a branch after the last branch (`gh stack add`)        |
| `P` | push and open the PRs as drafts (`gh stack submit --auto`) |
| `p` | push, and open PRs up to this branch (`gh stack link`)     |
| `r` | rebase the stack without a push (`gh stack rebase`)        |
| `S` | sync the stack (`gh stack sync --prune`)                   |
| `o` | open the PR of the branch in the browser                   |

**Keys on a normal branch:**

| Key       | Action                                                          |
| --------- | --------------------------------------------------------------- |
| `p` / `P` | push, and open a draft PR into the default branch               |
| `r`       | rebase onto the default branch, without a push                  |
| `o`       | open the PR of the branch in the browser                        |
| `n`       | make a stack: this branch is first, a new branch comes after it |
| `d`       | delete the branch                                               |

`p` pushes with `--force-with-lease`, so a rebased branch can push. When the
branch already has an open PR, the push updates it. Otherwise
`gh pr create --draft --fill` opens a draft PR, with the title and body from the
commits. A branch without commits after the default branch cannot get a PR.

`n` runs `gh stack init --base <default> <branch> <new>`. `gh stack` adopts the
existing branch as the first branch of a new stack, and makes the new branch
after it. The branch is then a stack branch.

`d` asks before it deletes. Press `y` to delete the local branch, or `a` to also
delete `origin/<branch>` (only when it exists). It uses `git branch -d`. When
git refuses because the branch is not merged, the TUI asks again before
`git branch -D`. A squash-merged PR also shows as not merged, because git cannot
see the squash. You cannot delete the current branch.

`r` runs `git rebase <default>` and goes back to the branch you were on. It does
not push: check the result, then press `p`. `r` does nothing when the branch
already contains the default branch.

When the rebase has a conflict, it stops there, as a stack rebase does. The
legend tells what to do: edit the files, `git add` them, then press `r` again.
`r` continues the rebase (`git rebase --continue`) and keeps the commit
messages. To stop the rebase and restore the branch, run `git rebase --abort` in
a terminal. The TUI also finds a rebase that you started in a terminal.

Rebase from `main` (`r` or `S` on the trunk) acts on stacks only. It does not
rebase normal branches: they can have open PRs, and a rebase needs a force-push.
Rebase each one with `r` when you want to. The `⚠` badge shows the branches that
need it.

`S` does not apply to a normal branch.

**New work always starts as a normal branch.** `n` on the default branch, or `N`
anywhere, makes a normal branch from the default branch
(`git switch -c <name> <default>`). Changes that are not committed come with
you. When you need a second branch after it, press `n` on it to make a stack. A
trunk that is not the default branch has only stacks, so `n` there starts a
stack (`gh stack init --base <trunk>`).

**Other keys:**

| Key               | Action                                 |
| ----------------- | -------------------------------------- |
| `↑`/`↓` (`k`/`j`) | move the cursor                        |
| `enter` / `c`     | check out the selected branch          |
| `tab` / `⇧tab`    | go to the next / previous tab          |
| `i` / `l`         | show the Info / Log tab                |
| `N`               | start a branch from the default branch |
| `R`               | reload the branches and the PR status  |
| `?`               | show the help                          |
| `q` / `esc`       | quit                                   |

The right panel shows Info, then Log below it, when the terminal is tall enough.
On a short terminal, they are tabs: `tab`, `i` and `l` change the tab.

The tree keeps a merged branch after `S` deletes it locally, as GitHub does. It
shows dimmed, with the `merged` badge. You cannot check it out, but `o` opens
its PR. The branch leaves the tree when `S` removes the stack.

**Other people's commits:** `S` and `P` force-push, as `gh stack` does. When
someone else pushed to your PR branch, get their commits first, or the push
deletes them.

All the commands run without a terminal, so `gh stack` does not show prompts.
For example, when `sync` finds that the local and remote stacks are different,
it stops. Run `gh stack sync` in a terminal to select what to do.

**Badges:**

| Badge         | Meaning                                  |
| ------------- | ---------------------------------------- |
| `●`           | the current branch                       |
| `⌂`           | the trunk                                |
| `○`           | a branch that is not checked out         |
| `≡`           | the first branch of a stack              |
| ` N`         | commits after the parent                 |
| `⚠`           | the parent has moved, use `r` or `S`     |
| ` merged`    | the PR is merged                         |
| `⇡N`          | N commits to push                        |
| `⇣N`          | N commits to pull                        |
| `local`       | the branch is not on origin yet          |
| `*`           | changes that are not committed           |
| `[gone]`      | the branch does not exist locally        |
| ` passing`   | CI checks passed (`running`, `failing`)  |
| `3d` (right)  | the time since the last commit           |
| ` review`    | the PR waits for a review                |
| ` approved`  | the PR is approved, but cannot merge yet |
| ` ready`     | the PR is ready to merge                 |
| ` rework`    | a reviewer requested changes             |
| ` behind`    | the base moved, update the PR branch     |
| ` conflicts` | the PR has merge conflicts               |
| ` draft`     | the PR is a draft                        |
| ` closed`    | the PR is closed and not merged          |

The PR icons are Nerd Font octicons, plus one codicon for conflicts. Use a
[Nerd Font](https://www.nerdfonts.com/) 3.5 or later in your terminal, or they
show as boxes.

To see all the badges in your terminal and font, run `bun run icons` in
`packages/git-tui`. It draws a mock branch list and info pane with the real
components, then the current icons and other icons that you can use instead.

The TUI reloads when branches, `HEAD` or `.git/gh-stack` change.

The PR status comes from one `gh pr list` call that reads the 200 newest PRs. A
branch with an older PR shows no PR.

### `log`

Print the tree of local branches without the TUI.

## Worktrees

`gh stack` keeps a separate stack file for each worktree. A stack that you made
in one worktree is not a stack in the others: there, its branches show as normal
branches. Use one worktree for the work on a stack.

## Limits

- The TUI does not merge PRs. Merge on GitHub.
- The TUI does not resolve conflicts. Edit the files, `git add` them, then press
  `r`.
- `gh stack` stacks are linear. A branch has one parent and one child. To put a
  branch in the middle of a stack, use `gh stack modify` in a terminal.
- The TUI does not find the real parent of a branch that is not in a stack. It
  shows such a branch below the default branch. Thus, when you make `b` from `a`
  outside the TUI (e.g. `git switch -c b a`), the `+N` count and the PR of `b`
  also include the commits of `a`. To make a branch after another branch, press
  `n` on it in the TUI. Then the TUI makes a stack.
- The format of `.git/gh-stack` is not documented. The TUI reads schema version
  1 only, and stops with an error for a newer version.
