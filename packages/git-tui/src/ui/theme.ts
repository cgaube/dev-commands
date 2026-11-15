import { writeSync } from 'fs'
import { RGBA } from '@opentui/core'
import type { TerminalColors } from './terminalColors'
import type { CiStatus, CheckState, PrStatus } from '#src/data/github'

export type Color = RGBA

type ColorName =
  | 'text'
  | 'background'
  | 'dim'
  | 'faint'
  | 'accent'
  | 'green'
  | 'red'
  | 'yellow'
  | 'magenta'
  | 'cyan'
  | 'selected'
  | 'keyFg'
  | 'keyBg'

export type Palette = Record<ColorName, Color>

const ansi = (index: number) => RGBA.fromIndex(index)

// The colors of the terminal palette, not fixed RGB values. This theme
// follows the theme of the terminal, light or dark.
const terminal: Palette = {
  text: RGBA.defaultForeground(),
  background: RGBA.defaultBackground(),
  // "Bright black": the gray of the terminal theme.
  dim: ansi(8),
  faint: ansi(8),
  accent: ansi(4),
  green: ansi(2),
  red: ansi(1),
  yellow: ansi(3),
  magenta: ansi(5),
  cyan: ansi(6),
  // Dim text on the selected row uses the default text color, else it does
  // not show on this gray.
  selected: ansi(8),
  // A key cap: dark text on the light gray of the terminal theme.
  keyFg: ansi(0),
  keyBg: ansi(7),
}

// Make a palette from hex values.
function hex(values: Record<ColorName, string>): Palette {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, RGBA.fromHex(value)]),
  ) as Palette
}

export const THEMES = [
  { id: 'terminal', label: 'terminal', palette: terminal },
  {
    id: 'dracula',
    label: 'dracula',
    palette: hex({
      text: '#f8f8f2',
      background: '#282a36',
      dim: '#6272a4',
      faint: '#44475a',
      accent: '#bd93f9',
      green: '#50fa7b',
      red: '#ff5555',
      yellow: '#f1fa8c',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      selected: '#44475a',
      keyFg: '#282a36',
      keyBg: '#f8f8f2',
    }),
  },
  {
    id: 'tokyo-night',
    label: 'tokyo night',
    palette: hex({
      text: '#c0caf5',
      background: '#1a1b26',
      dim: '#737aa2',
      faint: '#3b4261',
      accent: '#7aa2f7',
      green: '#9ece6a',
      red: '#f7768e',
      yellow: '#e0af68',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      selected: '#283457',
      keyFg: '#1a1b26',
      keyBg: '#a9b1d6',
    }),
  },
  {
    id: 'catppuccin-mocha',
    label: 'catppuccin mocha',
    palette: hex({
      text: '#cdd6f4',
      background: '#1e1e2e',
      dim: '#7f849c',
      faint: '#45475a',
      accent: '#89b4fa',
      green: '#a6e3a1',
      red: '#f38ba8',
      yellow: '#f9e2af',
      magenta: '#cba6f7',
      cyan: '#94e2d5',
      selected: '#313244',
      keyFg: '#1e1e2e',
      keyBg: '#bac2de',
    }),
  },
  {
    id: 'gruvbox',
    label: 'gruvbox',
    palette: hex({
      text: '#ebdbb2',
      background: '#282828',
      dim: '#928374',
      faint: '#504945',
      accent: '#83a598',
      green: '#b8bb26',
      red: '#fb4934',
      yellow: '#fabd2f',
      magenta: '#d3869b',
      cyan: '#8ec07c',
      selected: '#3c3836',
      keyFg: '#282828',
      keyBg: '#d5c4a1',
    }),
  },
  {
    id: 'nord',
    label: 'nord',
    palette: hex({
      text: '#eceff4',
      background: '#2e3440',
      dim: '#7b88a1',
      faint: '#4c566a',
      accent: '#88c0d0',
      green: '#a3be8c',
      red: '#bf616a',
      yellow: '#ebcb8b',
      magenta: '#b48ead',
      cyan: '#8fbcbb',
      selected: '#3b4252',
      keyFg: '#2e3440',
      keyBg: '#d8dee9',
    }),
  },
  {
    id: 'catppuccin-latte',
    label: 'catppuccin latte',
    palette: hex({
      text: '#4c4f69',
      background: '#eff1f5',
      dim: '#8c8fa1',
      faint: '#bcc0cc',
      accent: '#1e66f5',
      green: '#40a02b',
      red: '#d20f39',
      yellow: '#df8e1d',
      magenta: '#8839ef',
      cyan: '#179299',
      selected: '#ccd0da',
      keyFg: '#eff1f5',
      keyBg: '#5c5f77',
    }),
  },
  {
    id: 'catppuccin-frappe',
    label: 'catppuccin frappé',
    palette: hex({
      text: '#c6d0f5',
      background: '#303446',
      dim: '#838ba7',
      faint: '#51576d',
      accent: '#8caaee',
      green: '#a6d189',
      red: '#e78284',
      yellow: '#e5c890',
      magenta: '#ca9ee6',
      cyan: '#81c8be',
      selected: '#414559',
      keyFg: '#303446',
      keyBg: '#b5bfe2',
    }),
  },
  {
    id: 'catppuccin-macchiato',
    label: 'catppuccin macchiato',
    palette: hex({
      text: '#cad3f5',
      background: '#24273a',
      dim: '#8087a2',
      faint: '#494d64',
      accent: '#8aadf4',
      green: '#a6da95',
      red: '#ed8796',
      yellow: '#eed49f',
      magenta: '#c6a0f6',
      cyan: '#8bd5ca',
      selected: '#363a4f',
      keyFg: '#24273a',
      keyBg: '#b8c0e0',
    }),
  },
  {
    id: 'cobalt',
    label: 'cobalt',
    palette: hex({
      text: '#ffffff',
      background: '#193549',
      dim: '#8095ab',
      faint: '#2a5577',
      accent: '#ffc600',
      green: '#3ad900',
      red: '#ff628c',
      yellow: '#ff9d00',
      magenta: '#fb94ff',
      cyan: '#80fcff',
      selected: '#1f4662',
      keyFg: '#193549',
      keyBg: '#ffc600',
    }),
  },
  {
    id: 'light-modern',
    label: 'light modern',
    palette: hex({
      text: '#3b3b3b',
      background: '#ffffff',
      dim: '#868686',
      faint: '#d4d4d4',
      accent: '#005fb8',
      green: '#388a34',
      red: '#cd3131',
      yellow: '#a36f00',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      selected: '#e4e6f1',
      keyFg: '#ffffff',
      keyBg: '#5f5f5f',
    }),
  },
  {
    id: 'material-dark',
    label: 'material dark',
    palette: hex({
      text: '#eeffff',
      background: '#212121',
      dim: '#757575',
      faint: '#424242',
      accent: '#82aaff',
      green: '#c3e88d',
      red: '#f07178',
      yellow: '#ffcb6b',
      magenta: '#c792ea',
      cyan: '#89ddff',
      selected: '#353535',
      keyFg: '#212121',
      keyBg: '#b0bec5',
    }),
  },
  {
    id: 'monokai',
    label: 'monokai',
    palette: hex({
      text: '#f8f8f2',
      background: '#272822',
      dim: '#75715e',
      faint: '#49483e',
      accent: '#66d9ef',
      green: '#a6e22e',
      red: '#f92672',
      yellow: '#e6db74',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      selected: '#3e3d32',
      keyFg: '#272822',
      keyBg: '#f8f8f2',
    }),
  },
  {
    id: 'one-dark',
    label: 'one dark',
    palette: hex({
      text: '#abb2bf',
      background: '#282c34',
      dim: '#5c6370',
      faint: '#3b4048',
      accent: '#61afef',
      green: '#98c379',
      red: '#e06c75',
      yellow: '#e5c07b',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      selected: '#3e4451',
      keyFg: '#282c34',
      keyBg: '#abb2bf',
    }),
  },
  {
    id: 'solarized-dark',
    label: 'solarized dark',
    palette: hex({
      text: '#93a1a1',
      background: '#002b36',
      dim: '#586e75',
      faint: '#0e4b5a',
      accent: '#268bd2',
      green: '#859900',
      red: '#dc322f',
      yellow: '#b58900',
      magenta: '#d33682',
      cyan: '#2aa198',
      selected: '#073642',
      keyFg: '#002b36',
      keyBg: '#93a1a1',
    }),
  },
  {
    id: 'solarized-light',
    label: 'solarized light',
    palette: hex({
      text: '#586e75',
      background: '#fdf6e3',
      dim: '#93a1a1',
      faint: '#d9d2c2',
      accent: '#268bd2',
      green: '#859900',
      red: '#dc322f',
      yellow: '#b58900',
      magenta: '#d33682',
      cyan: '#2aa198',
      selected: '#eee8d5',
      keyFg: '#fdf6e3',
      keyBg: '#586e75',
    }),
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS: ThemeId[] = THEMES.map((t) => t.id)

// The colors of the active theme. The components read it when they render,
// so a theme change takes effect at the next render of the App.
export const color: Palette = { ...terminal }

// Use a theme. An unknown id uses the default theme.
// Mix two colors: `amount` 0 gives `from`, 1 gives `to`.
function mix(from: RGBA, to: RGBA, amount: number): RGBA {
  const [r1, g1, b1] = from.toInts()
  const [r2, g2, b2] = to.toInts()
  const at = (a: number, b: number) => Math.round(a + (b - a) * amount)
  return RGBA.fromInts(at(r1, r2), at(g1, g2), at(b1, b2))
}

// Make the grays of the terminal theme from the real colors of the
// terminal. "Bright black" (ANSI 8) is near the background in many terminal
// themes (for example in Warp), and then the dim text does not show. A mix of
// the text color and the background always shows, on a light or a dark
// terminal. The text and the background stay the default colors of the
// terminal: the TUI does not paint a background.
// When the terminal does not tell its colors, keep ANSI 8.
export function adaptTerminalTheme({ fg, bg }: TerminalColors) {
  if (!fg || !bg) return
  const text = RGBA.fromHex(fg)
  const back = RGBA.fromHex(bg)
  Object.assign(terminal, {
    // Labels, ages, hints: secondary text, easy to read.
    dim: mix(back, text, 0.6),
    // Borders and rails: they only separate.
    faint: mix(back, text, 0.3),
    // The selected row: a band that dim text still shows on.
    selected: mix(back, text, 0.15),
  })
  if (current === 'terminal') Object.assign(color, terminal)
}

let current: ThemeId = 'terminal'

export function applyTheme(id: unknown): ThemeId {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]
  Object.assign(color, theme.palette)
  current = theme.id
  paintTerminalBackground(theme.id)
  return theme.id
}

// Set the default background color of the terminal (OSC 11) to the color
// of the theme. The TUI paints each cell, but the terminal paints the space
// around the cells: its padding, and the strip on the right and the bottom
// when the window is not a whole number of cells (for example in Warp).
// Without this, that space has the terminal color and looks like a border.
// The `terminal` theme resets the color (OSC 111). OpenTUI also resets it
// when it stops. A terminal that does not know OSC 11 ignores it.
// Reset the background color of the terminal also when the process ends in
// an unusual way, for example after a crash.
// Warp does not set the background with OSC 11: in a test, it made the
// text black instead. So never send it there.
const canSetBackground = process.env.TERM_PROGRAM !== 'WarpTerminal'

process.on('exit', () => {
  if (!canSetBackground) return
  try {
    writeSync(1, '\x1b]111\x1b\\')
  } catch {
    // Not a terminal.
  }
})

function paintTerminalBackground(id: ThemeId) {
  if (!canSetBackground) return
  const ST = '\x1b\\'
  let sequence = `\x1b]111${ST}`
  if (id !== 'terminal') {
    const hex = color.background
      .toInts()
      .slice(0, 3)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
    sequence = `\x1b]11;#${hex}${ST}`
  }
  try {
    // Write to the file descriptor, not to process.stdout: the renderer can
    // capture process.stdout.
    writeSync(1, sequence)
  } catch {
    // Not a terminal. Nothing to paint.
  }
}

export function themeLabel(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.label ?? id
}

export const prColor = (status: PrStatus): Color =>
  ({
    merged: color.magenta,
    closed: color.dim,
    draft: color.dim,
    conflicts: color.red,
    changes: color.red,
    behind: color.yellow,
    ready: color.green,
    approved: color.green,
    review: color.accent,
  })[status]

export const ciIcon = (status: CiStatus): { icon: string; fg: Color } =>
  ({
    passed: { icon: '✓', fg: color.green },
    failed: { icon: '✗', fg: color.red },
    pending: { icon: '●', fg: color.yellow },
    none: { icon: ' ', fg: color.dim },
  })[status]

export const checkIcon = (state: CheckState): { icon: string; fg: Color } =>
  ({
    passed: { icon: '✓', fg: color.green },
    failed: { icon: '✗', fg: color.red },
    pending: { icon: '●', fg: color.yellow },
    skipped: { icon: '-', fg: color.dim },
  })[state]

// A short age, for example "5m", "3h" or "2d".
export function age(seconds: number | null): string {
  if (!seconds) return ''
  const diff = Math.max(0, Date.now() / 1000 - seconds)
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 60) return `${Math.floor(diff / 86400)}d`
  return `${Math.floor(diff / (86400 * 30))}mo`
}
