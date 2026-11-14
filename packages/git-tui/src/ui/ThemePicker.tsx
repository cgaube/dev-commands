import { useState } from 'react'
import { HintBar } from './Kbd'
import { color, THEMES, type ThemeId } from './theme'

// The list of themes. The highlighted theme is the active theme: the App
// shows it as a preview while the user moves through the list.
export function ThemePicker({
  active,
  saved,
  onHighlight,
  onPick,
  onKey,
}: {
  active: ThemeId
  // The theme that was in use when the picker opened.
  saved: ThemeId
  onHighlight: (id: ThemeId) => void
  onPick: (id: ThemeId) => void
  onKey: (key: string) => void
}) {
  return (
    <box
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      flexShrink={0}
      onMouseScroll={(event) => {
        const direction = event.scroll?.direction
        if (direction === 'up' || direction === 'down') onKey(direction)
      }}
    >
      {THEMES.map((theme) => (
        <ThemeLine
          key={theme.id}
          id={theme.id}
          label={theme.label}
          active={theme.id === active}
          saved={theme.id === saved}
          onHighlight={onHighlight}
          onPick={onPick}
        />
      ))}
      <box marginTop={1}>
        <HintBar
          items={[
            { key: 'return', label: 'use' },
            { key: 'escape', label: 'cancel' },
          ]}
          onPress={onKey}
        />
      </box>
    </box>
  )
}

function ThemeLine({
  id,
  label,
  active,
  saved,
  onHighlight,
  onPick,
}: {
  id: ThemeId
  label: string
  active: boolean
  saved: boolean
  onHighlight: (id: ThemeId) => void
  onPick: (id: ThemeId) => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <box
      flexDirection="row"
      height={1}
      backgroundColor={active ? color.selected : undefined}
      // A click uses the theme. Moving the mouse over a theme previews it.
      onMouseDown={() => onPick(id)}
      onMouseOver={() => {
        setHover(true)
        onHighlight(id)
      }}
      onMouseOut={() => setHover(false)}
    >
      <text flexGrow={1} wrapMode="none" truncate>
        <span fg={color.accent}>{active ? '›' : ' '} </span>
        <span fg={color.text}>{hover && !active ? <u>{label}</u> : label}</span>
      </text>
      {/* A sample of the colors of the theme. It shows the preview colors,
          because the highlighted theme is the active theme. */}
      {active && (
        <text flexShrink={0}>
          <span fg={color.green}>●</span>
          <span fg={color.yellow}>●</span>
          <span fg={color.red}>●</span>
          <span fg={color.accent}>●</span>
          <span fg={color.magenta}>●</span>
          <span fg={color.cyan}>●</span>
        </text>
      )}
      <text flexShrink={0} fg={active ? color.text : color.dim}>
        {saved ? '  current' : ''}
      </text>
    </box>
  )
}
