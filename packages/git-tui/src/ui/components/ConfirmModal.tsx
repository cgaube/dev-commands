import { Box, Text, useInput } from 'ink'
import { Kbd } from './Kbd'

export type Choice = [key: string, label: string]

type Props = {
  title: string
  message: string
  // The keys that confirm, e.g. [["y", "delete"], ["a", "also on origin"]].
  choices: Choice[]
  onChoose: (key: string) => void
  onCancel: () => void
}

// Ask before an action that cannot be undone. Esc or any other key cancels.
export function ConfirmModal({
  title,
  message,
  choices,
  onChoose,
  onCancel,
}: Props) {
  useInput((input) => {
    if (choices.some(([key]) => key === input)) onChoose(input)
    else onCancel()
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      width="75%"
    >
      <Text bold color="yellow">
        {title}
      </Text>
      <Text>{message}</Text>
      <Box justifyContent="flex-end" columnGap={1} flexWrap="wrap">
        {choices.map(([key, label]) => (
          <Box key={key}>
            <Kbd>{key}</Kbd>
            <Text dimColor> {label}</Text>
          </Box>
        ))}
        <Box>
          <Kbd>esc</Kbd>
          <Text dimColor> cancel</Text>
        </Box>
      </Box>
    </Box>
  )
}
