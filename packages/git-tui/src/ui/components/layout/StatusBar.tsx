import { Box } from 'ink'
import { Spinner, StatusMessage } from '@inkjs/ui'
import type { StatusVariant } from '../../hooks/useStackData'

type Props = {
  busy: boolean
  status: string
  variant: StatusVariant
}

// A live spinner while an operation runs, otherwise a StatusMessage coloured by
// the outcome (success/error/info).
export function StatusBar({ busy, status, variant }: Props) {
  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1} flexShrink={0}>
      {busy ? (
        <Spinner label={status} />
      ) : (
        <StatusMessage variant={variant}>{status}</StatusMessage>
      )}
    </Box>
  )
}
