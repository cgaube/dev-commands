import type { ReactNode } from 'react'
import { Box, Text } from 'ink'
import type { StatusVariant } from '../hooks/useStackData'

const ICONS: Record<StatusVariant, { icon: string; color: string }> = {
  success: { icon: '✔', color: 'green' },
  error: { icon: '✘', color: 'red' },
  info: { icon: 'ℹ', color: 'blue' },
}

// A message after an icon in the color of its outcome.
export function StatusMessage({
  variant,
  children,
}: {
  variant: StatusVariant
  children: ReactNode
}) {
  const { icon, color } = ICONS[variant]
  return (
    <Box gap={1}>
      <Box flexShrink={0}>
        <Text color={color}>{icon}</Text>
      </Box>
      <Text>{children}</Text>
    </Box>
  )
}
