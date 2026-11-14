# @devcommands/git-tui

A full-screen TUI that shows your local branches, your `gh stack` stacks, what
each branch has committed, and the PR and CI status of each branch.

It uses [OpenTUI](https://github.com/anomalyco/opentui) for the screen and
[TanStack Query](https://tanstack.com/query) for the data cache.

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`), logged in.
- The `gh stack` extension, for stacks:

  ```bash
  gh extension install github/gh-stack
  ```

- [Claude Code](https://claude.com/claude-code) (`claude`), only to fix
  conflicts with the `a` key.

## Install

```bash
dev packages install git-tui
```

## Usage

```bash
dev git-tui
```

## The list

The list shows the branches as `gh stack view` does: the newest work is on top,
and the default branch is at the bottom, because all work starts from it.

```text
╭─ stack #12
│ ● 3 c                       +2 ⇡2 #45 draft ●    5m
│ ○ 2 b                          +1 #44 review ✓   2h
╰ ✓ 1 a                              #43 merged    1d

╭─ standalone
╰ ○ fix-typo                       +1 #46 review ✗   3h

◆ main                                            1d
```

- Each stack, and the standalone branches, have a line on the left, from the
  header to the last branch.
- The dot shows the state of each branch: `●` the current branch, `○` an open
  branch, `✓` a merged branch, `·` a branch that does not exist locally, `◆` the
  default branch.
- Two or more merged branches of a stack fold into one line, for example
  `✓ 1–3 3 merged ▸`. Press `enter` or click the line to open it. Press `z` on a
  branch of the stack to fold them again.
- `⟳ S to sync` on a stack header: merged branches of the stack still exist
  locally. `S` deletes them, and rebases the branches above them.
- A stack shows its top branch first. The number is the position in the stack,
  from 1 (the branch that starts from `main`).
- A normal branch is a local branch that is not in a stack. Its parent is always
  the default branch.
- The newest normal branches are first.

New stacks always start from the default branch. A stack that a terminal command
made on another trunk shows the trunk in its header, for example
`stack #12 on develop`.

### Badges

| Badge        | Meaning                                          |
| ------------ | ------------------------------------------------ |
| `●` (left)   | the current branch                               |
| `◆`          | the default branch                               |
| `✎N`         | N files with changes that are not committed      |
| `+N`         | N commits after the parent                       |
| `⚠ rebase`   | the parent has new commits. Press `r` or `S`     |
| `⇡N` / `⇣N`  | N commits to push / to pull                      |
| `local`      | the branch is not on origin                      |
| `gone`       | the branch was on origin, and origin deleted it  |
| `deleted`    | a stack branch that is not local, and not merged |
| `#N status`  | the PR number and its status                     |
| `✓ ✗ ●`      | CI passed / failed / running                     |
| `5m` (right) | the time since the last commit                   |

The PR status is one of: `draft`, `review`, `approved`, `ready`, `changes` (a
reviewer requested changes), `behind`, `conflicts`, `merged`, `closed`.

A merged branch shows dimmed, without push and rebase badges.

### The details pane

The pane at the right shows the selected branch:

- **Title:** the branch name, and the PR status as a colored label.
- **Stack map:** for a stack branch, the stack from the trunk to the top, for
  example `main › 1✓ › [2] › 3`. The selected branch is highlighted. A check
  mark shows a merged branch.
- **Pull request:** the title (click it to open the PR), then:
  - `author`: who opened it, when, and when it was merged.
  - `base`: the branch that the PR goes into. A `⚠` shows when it is not the
    parent of the branch.
  - `size`: the lines added and removed, and the number of files.
  - `reviews`: `✓` approved, `✗` changes requested, `○` commented, `●` review
    requested.
  - `threads`: the review threads that are not resolved, and the comments.
  - `CI`: a bar with the checks (red failed, yellow running, green passed), and
    the names of the checks that failed or are running. Click a check to open
    it.
- **Local:** the commits to push and to pull, a rebase hint, and the files that
  are not committed (current branch only).
- **Commits**, at the bottom of the pane: the commits after the parent, newest
  first. Below a divider, dimmed: the commit of the parent that the branch
  starts from. For a merged branch that does not exist locally, the TUI reads
  the commits of its PR from GitHub.

When a fold of merged branches is selected, the pane shows each merged PR: its
title (click it to open the PR), when it merged, and its size. The `next` line
tells the next step for the stack: `S` to sync when merged branches still exist
locally, `d` to remove the stack when all its branches are merged. `S` and `d`
also work when the fold is selected.

When the terminal is less than 100 columns wide, the pane goes below the list.

## Keys

| Key           | Action                                        |
| ------------- | --------------------------------------------- |
| `↑ ↓` / `j k` | select a branch                               |
| `g` / `G`     | go to the first / last branch                 |
| `enter`       | check out the branch, or open a fold          |
| `z`           | fold or open the merged branches of a stack   |
| `n`           | start a normal branch from the default branch |
| `s`           | stack: add a branch on top of the stack       |
| `p`           | push and open a draft PR                      |
| `r`           | rebase onto the parent, without a push        |
| `S`           | sync the stack, or update the default branch  |
| `o`           | open the PR in the browser                    |
| `d`           | delete a normal branch                        |
| `a`           | let Claude fix the conflicts of a rebase      |
| `u`           | undo the last rebase or sync                  |
| `c`           | continue the rebase                           |
| `A`           | abort the rebase                              |
| `R`           | reload the branches and the PRs               |
| `?`           | show the keys                                 |
| `q` / `esc`   | quit                                          |

The footer shows the keys for the selected branch as key caps, and the status on
the same line. When the window is too narrow, the status goes on its own line
above the keys. Click a key cap to run its action.

## Questions

A question opens in a box in the middle of the screen, and the rest of the
screen is dim until you answer. The color tells the risk:

| Color  | Questions                                                       |
| ------ | --------------------------------------------------------------- |
| blue   | the name of a new branch                                        |
| yellow | changes that you can undo: abort a rebase, undo, remove a stack |
| red    | changes that can lose work: delete a branch                     |

Press the key that the box shows, for example `y`. `enter` never confirms a
change, and all other keys cancel. Messages that need no answer, for example
`pushed` or an error of a command, show in the status line only.

## Mouse

| Action                | Result                          |
| --------------------- | ------------------------------- |
| click a branch        | select it                       |
| double-click a branch | check it out                    |
| scroll on the list    | move the selection              |
| click a key cap       | run its action, as the key does |
| click the PR title    | open the PR in the browser      |
| click a CI check      | open the page of the check      |

## Themes

Press `t`, or click the theme name at the top right, to open the theme picker.
Move through the list with `↑ ↓` or the mouse: the TUI shows each theme as a
preview. Press `enter` or click a theme to use it. Press `esc` to keep the old
theme.

The themes:

| Theme                  | Colors                                             |
| ---------------------- | -------------------------------------------------- |
| `terminal`             | the 16 colors of your terminal theme (the default) |
| `dracula`              | Dracula                                            |
| `tokyo-night`          | Tokyo Night                                        |
| `catppuccin-mocha`     | Catppuccin Mocha                                   |
| `gruvbox`              | Gruvbox dark                                       |
| `nord`                 | Nord                                               |
| `catppuccin-latte`     | Catppuccin Latte, a light theme                    |
| `catppuccin-frappe`    | Catppuccin Frappé                                  |
| `catppuccin-macchiato` | Catppuccin Macchiato                               |
| `cobalt`               | Cobalt2                                            |
| `light-modern`         | VS Code Light Modern, a light theme                |
| `material-dark`        | Material Darker                                    |
| `monokai`              | Monokai                                            |
| `one-dark`             | One Dark                                           |
| `solarized-dark`       | Solarized Dark                                     |
| `solarized-light`      | Solarized Light, a light theme                     |

The `terminal` theme does not use fixed RGB colors. Thus it follows your
terminal theme, light or dark. The other themes set their own background.

A theme other than `terminal` also sets the background color of the terminal
(the `OSC 11` escape sequence). Then the space around the cells has the same
color: the padding of the terminal, and the strip on the right and the bottom
when the window is not a whole number of cells. The TUI restores the color when
it stops. A terminal that does not know `OSC 11` shows that space in its own
color.

Warp does not support `OSC 11` to set the color (it makes the text black), so
the TUI does not send it there. In Warp, the strip on the right and the bottom
has the color of the Warp theme. To make it match, use a Warp theme with the
same background, or the `terminal` theme in the TUI.

The TUI saves the theme in the configuration of your home directory, as
`config init` does. Thus it applies in all repositories. You can also set it
without the TUI:

```bash
dev git-tui config init
```

To use another theme in one repository, run
`dev git-tui config override set theme` in it. In that repository, the picker
still changes the theme until you quit, but the override comes back at the next
start.

### What each key does

- `n` runs `git switch -c <name> <default>`. Changes that are not committed come
  with you.
- `s` on a stack branch checks out the top branch, then runs
  `gh stack add <name>`. `s` on a normal branch makes a stack:
  `gh stack init --base <default> <branch> <name>`. The branch is the first
  branch of the stack, and the new branch comes after it.
- `p` on a stack branch runs `gh stack submit --auto`. It pushes all the
  branches of the stack and opens the missing PRs as drafts. `p` on a normal
  branch runs `git push --force-with-lease`, then `gh pr create --draft --fill`
  when the branch has no open PR.
- `r` on a stack branch runs `gh stack rebase`. `r` on a normal branch runs
  `git rebase <default>`. Nothing is pushed: check the result, then press `p`.
- `S` on a stack branch runs `gh stack sync --prune`. It fetches, rebases,
  pushes, and deletes the local branches of merged PRs. `S` on the default
  branch fetches it and fast-forwards it. It never forces: when the default
  branch has local commits, it stops.
- `d` on a stack branch removes a finished stack: a stack of which all the
  branches are merged or deleted. It runs `gh stack unstack --local`, so the
  stack stays on GitHub. When no branch of the stack exists, `gh stack` cannot
  check out the stack, so the TUI makes the first branch again at the trunk for
  a moment, and deletes it after.
- `d` on a normal branch asks first. Press `y` to delete the local branch, or
  `a` to also delete `origin/<branch>`. When git says that the branch is not
  merged (also after a squash merge), it asks again before `git branch -D`.

`gh stack` commands act on the stack of the current branch. Thus the TUI checks
out the selected branch before it runs them.

## Conflicts

When a rebase or a sync stops on a conflict, a red banner shows the files with
conflicts. Only the rebase keys work until the rebase is done.

### Fix with Claude (optional)

Press `a`. The TUI runs [Claude Code](https://claude.com/claude-code) in the
background (`claude -p`), with your usual Claude login. The right pane shows
what Claude does, for example `reading src/a.ts`. Then:

1. Claude resolves the conflicts and stages the files with `git add`.
2. The TUI checks that no conflicts and no conflict markers are left.
3. The TUI continues the rebase. When the next commit also has a conflict,
   Claude does the next round.
4. When the rebase is done, the pane shows the summary of Claude for each round.
   Nothing is pushed: review the result, then press `p`.

Press `esc` to stop Claude. Claude can only read and edit files, search, and run
`git status`, `git diff`, `git log`, `git show` and `git add`. It does not
continue, abort or commit: the TUI does these steps.

Claude is optional. When the `claude` command is not installed, or the
`conflictAgent` setting is `off`, the `a` key does not show. To turn it off:

```bash
dev git-tui config init
```

### Fix by hand

Edit the files, `git add` them, then press `c` to continue. For a stack, this
runs `gh stack rebase --continue`, not `git rebase --continue`. Press `A` to
abort the rebase and restore the branches.

### Undo

Before each rebase and sync, the TUI saves the commit of each branch that the
operation can change. Press `u` to move the branches back, also after the rebase
is done (for example, when you do not like the fix of Claude). The undo point
stays until the next push. The undo changes local branches only: when the rebase
was pushed, push again after the undo.

## Data and cache

The TUI uses only `git` and `gh`. TanStack Query keeps a cache for each data
source:

| Data                         | Source                    | Reload                             |
| ---------------------------- | ------------------------- | ---------------------------------- |
| branches, stacks, rebase     | `git`, `.git/gh-stack`    | when `.git` changes, after actions |
| PRs and CI checks            | one `gh api graphql` call | each 15 s while CI runs, else 60 s |
| commits of the branch        | `git log`                 | when the branch moves              |
| files that are not committed | `git status`              | when `.git` changes, after actions |

`R` reloads all of them.

The PR data comes from one GraphQL call (`gh api graphql`) that asks for the PR
of each branch in the list by its name. Thus it does not read the PRs of other
people, and an old PR also shows. A branch with more than one PR shows the
newest one.

The TUI keeps the last PR data in `.git/git-tui-prs.json`. At the next start, it
shows this data at once, and the header shows its age, for example `PRs 2m ago`.
Then it reads the new data from GitHub in the background.

The TUI also writes `.git/git-tui-undo.json` for the undo point. Git does not
track the files in `.git`.

`gh stack view --json` shows only the stack of the current branch. To show all
the stacks, the TUI reads `.git/gh-stack`. It reads only the order of the
branches and the PR numbers. The format of this file is not documented. The TUI
reads schema version 1 only, and shows an error for a newer version.

## Limits

- The TUI does not merge PRs. Merge on GitHub, then press `S`.
- `gh stack` stacks are linear. To put a branch in the middle of a stack, use
  `gh stack modify` in a terminal.
- The TUI does not find the real parent of a normal branch. When you make `b`
  from `a` outside the TUI, the commits of `b` also include the commits of `a`.
  To make a branch after another branch, press `s` on it.
- `S` and `p` on a stack force-push, as `gh stack` does. When someone else
  pushed to your PR branch, get their commits first.
