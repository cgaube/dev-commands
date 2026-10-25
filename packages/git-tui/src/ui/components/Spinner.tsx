import { Box, Text, useAnimation } from 'ink'

// The "dots" spinner of cli-spinners. Ink drives all animations with one
// timer, so the spinners on screen move together.
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function Spinner({ label }: { label?: string }) {
  const { frame } = useAnimation({ interval: 80 })
  return (
    <Box gap={1}>
      <Text color="blue">{FRAMES[frame % FRAMES.length]}</Text>
      {label && <Text>{label}</Text>}
    </Box>
  )
}
