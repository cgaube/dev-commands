import { Kbd } from './Kbd'
import { color } from './theme'

// A group title, or the keys and what they do.
const KEYS: Array<[string[], string] | string> = [
  'Move',
  [['↑', '↓', 'j', 'k'], 'select a branch'],
  [['g', 'G'], 'go to the first / last branch'],
  [['return'], 'check out the branch, or open a fold'],
  [['z'], 'fold or open the merged branches of a stack'],
  'Work',
  [['n'], 'start a new branch from the default branch'],
  [['s'], 'stack: add a branch on top (or make a stack)'],
  [['p'], 'push to origin, no PR (stack: gh stack push)'],
  [['P'], 'create a PR: AI writes it (stack: gh stack submit)'],
  [['r'], 'rebase onto the parent, no push'],
  [['S'], 'sync the stack (trunk: update, clean up merged)'],
  [['o'], 'open the PR in the browser'],
  [['d'], 'delete a normal branch'],
  'Conflicts',
  [['a'], 'let Claude fix the conflicts'],
  [['c'], 'continue the rebase'],
  [['A'], 'abort the rebase'],
  [['u'], 'undo the last rebase or sync'],
  'Other',
  [['R'], 'reload the branches and the PRs'],
  [['t'], 'choose a color theme'],
  [['?'], 'show or hide this help'],
  [['q', 'esc'], 'quit'],
]

export function Help() {
  return (
    <box flexDirection="column" paddingLeft={1} flexShrink={0}>
      {KEYS.map((entry, i) =>
        typeof entry === 'string' ? (
          <text key={i} fg={color.accent} marginTop={i ? 1 : 0}>
            <strong>{entry}</strong>
          </text>
        ) : (
          <box key={i} flexDirection="row" height={1}>
            <text width={18} flexShrink={0}>
              {entry[0].map((k) => (
                <span key={k}>
                  <Kbd k={k} />{' '}
                </span>
              ))}
            </text>
            <text fg={color.text}>{entry[1]}</text>
          </box>
        ),
      )}
      <text fg={color.accent} marginTop={1}>
        <strong>Mouse</strong>
      </text>
      {MOUSE_HELP.map((line) => (
        <text key={line} fg={color.text}>
          {line}
        </text>
      ))}
    </box>
  )
}

const MOUSE_HELP = [
  'click a branch to select it, double-click to check it out',
  'right-click a branch for a menu of its actions',
  'drag over text to copy it (double-click: a word, triple: a line)',
  'scroll the list with the wheel',
  'click a key cap to run its action',
  'click the theme name at the top right to choose a theme',
  'click the PR title or a CI check to open it',
]
