import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

type Props = {
  title: string
  // A read-only line above the input, e.g. ["on top of", "feat/api"].
  context?: [label: string, value: string]
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InputModal({
  title,
  context,
  label,
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
        {title}
      </Text>
      {context && (
        <Box>
          <Box width={11}>
            <Text dimColor>{context[0]}</Text>
          </Box>
          <Text>{context[1]}</Text>
        </Box>
      )}
      <Box>
        <Box width={11}>
          <Text dimColor>{label}</Text>
        </Box>
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
      </Box>
      <Box justifyContent="flex-end">
        <Text dimColor>enter confirm · esc cancel</Text>
      </Box>
    </Box>
  )
}
