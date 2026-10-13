import { Text } from 'ink'

// A single key rendered as a <kbd>-style cap: padded glyph on an inverted
// background so it reads as a physical key, the way web UIs style shortcuts.
export function Kbd({ children }: { children: string }) {
  return (
    <Text color="black" backgroundColor="gray" bold>
      {` ${children} `}
    </Text>
  )
}
