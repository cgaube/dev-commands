import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

type Props = {
  branch: string
  value: string
  onChange: (value: string) => void
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function RenameModal({
  branch,
  value,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  useInput((_input, key) => {
    if (key.escape) onCancel()
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      width="75%"
    >
      <Text bold color="cyan">
        Rename branch
      </Text>
      <Box>
        <Box width={9}>
          <Text dimColor>current</Text>
        </Box>
        <Text>{branch}</Text>
      </Box>
      <Box>
        <Box width={9}>
          <Text dimColor>new name</Text>
        </Box>
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
      </Box>
      <Box justifyContent="flex-end">
        <Text dimColor>enter confirm · esc cancel</Text>
      </Box>
    </Box>
  )
}
