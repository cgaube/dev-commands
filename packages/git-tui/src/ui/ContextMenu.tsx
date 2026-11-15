import { capWidth, Kbd, type HintItem } from './Kbd'
import { color } from './theme'

// The menu of a right click on a row: the actions of the row, as the footer
// shows them. A click on an item, or enter, acts as its key press.
export function ContextMenu({
  items,
  index,
  x,
  y,
  width,
  height,
  onHighlight,
  onPick,
  onClose,
}: {
  items: HintItem[]
  // The highlighted item.
  index: number
  // The cell of the click.
  x: number
  y: number
  // The size of the terminal.
  width: number
  height: number
  onHighlight: (index: number) => void
  onPick: (key: string) => void
  onClose: () => void
}) {
  const capCells = Math.max(...items.map((i) => capWidth(i.key)))
  const labelCells = Math.max(...items.map((i) => i.label.length))
  // The borders, one space each side, the cap, a space, the label.
  const boxWidth = Math.min(width, capCells + labelCells + 5)
  const boxHeight = items.length + 2
  // Keep the menu on the screen: move it left or up when it does not fit.
  const left = Math.max(0, Math.min(x, width - boxWidth))
  const top = Math.max(0, Math.min(y, height - boxHeight))
  return (
    <>
      {/* A click outside the menu closes it. */}
      <box
        position="absolute"
        left={0}
        top={0}
        width={width}
        height={height}
        zIndex={9}
        onMouseDown={onClose}
      />
      <box
        position="absolute"
        left={left}
        top={top}
        width={boxWidth}
        zIndex={10}
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={color.accent}
        backgroundColor={color.background}
      >
        {items.map((item, i) => (
          <box
            key={item.key}
            height={1}
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={i === index ? color.selected : undefined}
            onMouseOver={() => onHighlight(i)}
            onMouseDown={() => onPick(item.key)}
          >
            <text wrapMode="none" truncate>
              <Kbd k={item.key} />
              {' '.repeat(capCells - capWidth(item.key) + 1)}
              <span fg={i === index ? color.text : color.dim}>
                {item.label}
              </span>
            </text>
          </box>
        ))}
      </box>
    </>
  )
}
