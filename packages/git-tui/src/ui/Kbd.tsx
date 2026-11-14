import { useState } from 'react'
import { color } from './theme'

// The labels to show on a key cap, for the key names that are not printed
// characters.
const CAP: Record<string, string> = {
  return: '⏎',
  escape: 'esc',
  up: '↑',
  down: '↓',
}

// A key, styled as a <kbd> key cap: the key on a light background, so that
// it looks like a physical key. Use it inside a <text>.
export function Kbd({ k }: { k: string }) {
  return (
    <span fg={color.keyFg} bg={color.keyBg}>
      <strong>{` ${CAP[k] ?? k} `}</strong>
    </span>
  )
}

export type HintItem = {
  key: string
  label: string
  // False for a hint that only informs, for example "enter" in a prompt.
  clickable?: boolean
}

// One key cap and its label. A click on it acts as the key press. The label
// is underlined while the mouse is over it.
function Hint({
  item,
  onPress,
}: {
  item: HintItem
  onPress?: (key: string) => void
}) {
  const [hover, setHover] = useState(false)
  const clickable = !!onPress && item.clickable !== false
  return (
    <text
      flexShrink={0}
      onMouseDown={clickable ? () => onPress(item.key) : undefined}
      onMouseOver={clickable ? () => setHover(true) : undefined}
      onMouseOut={clickable ? () => setHover(false) : undefined}
    >
      <Kbd k={item.key} />
      <span fg={hover ? color.text : color.dim}>
        {' '}
        {hover ? <u>{item.label}</u> : item.label}
      </span>
    </text>
  )
}

// A row of hints, with a space between them.
export function HintBar({
  items,
  onPress,
}: {
  items: HintItem[]
  onPress?: (key: string) => void
}) {
  return (
    <box flexDirection="row" height={1} gap={2} overflow="hidden">
      {items.map((item) => (
        <Hint key={item.key} item={item} onPress={onPress} />
      ))}
    </box>
  )
}

// The number of cells that a HintBar of these items uses.
export function hintsWidth(items: HintItem[]): number {
  const GAP = 2
  return items.reduce(
    (sum, item, i) =>
      sum +
      (i ? GAP : 0) +
      (CAP[item.key] ?? item.key).length +
      2 +
      1 +
      item.label.length,
    0,
  )
}
