import type { PrText } from '#src/prDescription'
import { Activity } from './Activity'
import type { HintItem } from './Kbd'
import { Modal, modalWidth } from './Modal'
import { color } from './theme'

// The preview is wider than the other modals: a PR description has long
// lines.
const MAX_WIDTH = 100
// The rows of the modal around the description: the borders, the padding,
// the title, the branches, the gaps and the hints.
const CHROME_ROWS = 8

// Cut the text into lines that fit in `width` cells. Break at spaces when
// possible. Empty lines stay.
function wrap(text: string, width: number): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    let rest = line
    while (rest.length > width) {
      const at = rest.lastIndexOf(' ', width)
      const cut = at > 0 ? at : width
      out.push(rest.slice(0, cut))
      rest = rest.slice(cut).replace(/^ /, '')
    }
    out.push(rest)
  }
  return out
}

// The lines of the description, and how many show at a time.
export function draftLayout(body: string, width: number, height: number) {
  // The borders and the padding of the modal use 6 cells.
  const lines = wrap(body, modalWidth(width, MAX_WIDTH) - 6)
  const rows = Math.max(
    body ? 3 : 0,
    Math.min(lines.length, height - CHROME_ROWS - 2),
  )
  return { lines, rows, maxOffset: Math.max(0, lines.length - rows) }
}

// One line of Markdown, with the headings in bold.
function BodyLine({ line }: { line: string }) {
  if (/^#{1,6} /.test(line)) {
    return (
      <text fg={color.accent} wrapMode="none">
        <strong>{line.replace(/^#+ /, '')}</strong>
      </text>
    )
  }
  return (
    <text fg={color.text} wrapMode="none">
      {line || ' '}
    </text>
  )
}

// A text that the AI writes (a PR or a commit message): the modal shows it,
// and the user reads it before it is used.
export function DraftModal({
  title,
  subtitle,
  writing,
  text,
  error,
  offset,
  frame,
  width,
  height,
  hints,
  onPress,
}: {
  title: string
  // One dim line under the title, for example "feat → main".
  subtitle: string
  // What the AI does, while it writes.
  writing: string
  // While both are missing, the AI is writing.
  text?: PrText
  error?: string
  offset: number
  // The animation frame. See Activity.
  frame: number
  width: number
  height: number
  hints: HintItem[]
  onPress: (key: string) => void
}) {
  const loading = !text && !error
  const { lines, rows, maxOffset } = draftLayout(
    text?.body ?? '',
    width,
    height,
  )
  const at = Math.min(offset, maxOffset)
  const shownRows = text ? rows : 1
  return (
    <Modal
      severity={error ? 'warning' : 'info'}
      title={title}
      width={width}
      height={height}
      maxWidth={MAX_WIDTH}
      top={Math.max(0, Math.floor((height - shownRows - CHROME_ROWS) / 2))}
      hints={hints}
      onPress={onPress}
    >
      <text fg={color.dim} wrapMode="none" truncate>
        {subtitle}
        {text && maxOffset > 0
          ? ` · lines ${at + 1}–${at + rows} of ${lines.length} (↑↓)`
          : ''}
      </text>
      {loading && (
        <text marginTop={1}>
          <Activity text={writing} frame={frame} />
        </text>
      )}
      {error && (
        <text fg={color.yellow} marginTop={1} wrapMode="word">
          {error}
        </text>
      )}
      {text && (
        <>
          <text fg={color.text} marginTop={1} wrapMode="word">
            <strong>{text.title}</strong>
          </text>
          {text.body && (
            <box
              marginTop={1}
              height={rows}
              flexDirection="column"
              flexShrink={0}
              onMouseScroll={(event) => {
                const direction = event.scroll?.direction
                if (direction === 'up' || direction === 'down')
                  onPress(direction)
              }}
            >
              {lines.slice(at, at + rows).map((line, i) => (
                <BodyLine key={at + i} line={line} />
              ))}
            </box>
          )}
        </>
      )}
    </Modal>
  )
}
