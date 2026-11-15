import type { ReactNode } from 'react'
import { HintBar, type HintItem } from './Kbd'
import { color, type Color } from './theme'

// How serious a question is. It sets the color and the icon of the modal.
// - info: a question without risk, for example the name of a new branch.
// - warning: a change that the user can undo, for example abort a rebase.
// - error: a change that can lose work, for example delete a branch.
export type Severity = 'info' | 'warning' | 'error'

const STYLE: Record<Severity, { icon: string; fg: () => Color }> = {
  info: { icon: 'ℹ', fg: () => color.accent },
  warning: { icon: '⚠', fg: () => color.yellow },
  error: { icon: '✗', fg: () => color.red },
}

// The widest that a modal can be, in cells.
const MAX_WIDTH = 64

// The width of a modal in a terminal of this width.
export function modalWidth(width: number, maxWidth = MAX_WIDTH): number {
  return Math.min(maxWidth, width - 4)
}

// A box in the middle of the screen, above the panes. The App dims the panes
// while a modal is open, and sends all the keys to the modal.
export function Modal({
  severity,
  title,
  width,
  height,
  hints,
  onPress,
  children,
  maxWidth = MAX_WIDTH,
  top,
}: {
  severity: Severity
  title: string
  // The size of the terminal.
  width: number
  height: number
  hints: HintItem[]
  onPress: (key: string) => void
  children: ReactNode
  // For a modal with much text, for example the preview of a PR.
  maxWidth?: number
  // The first row of the modal. By default, a third of the way down.
  top?: number
}) {
  const style = STYLE[severity]
  const boxWidth = modalWidth(width, maxWidth)
  return (
    <box
      position="absolute"
      left={Math.max(0, Math.floor((width - boxWidth) / 2))}
      top={top ?? Math.max(0, Math.floor(height / 3))}
      width={boxWidth}
      zIndex={10}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={style.fg()}
      title={` ${style.icon} ${title} `}
      titleColor={style.fg()}
      backgroundColor={color.background}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
    >
      {children}
      <box marginTop={1} height={1}>
        <HintBar items={hints} onPress={onPress} />
      </box>
    </box>
  )
}
