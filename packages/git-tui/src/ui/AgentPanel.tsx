import { HintBar } from './Kbd'
import { color } from './theme'

export type AgentState = {
  status: 'running' | 'done' | 'failed'
  // The rounds and the tool calls, oldest first.
  steps: Array<{ kind: 'round' | 'step'; text: string }>
  // One summary of Claude for each round.
  summaries: string[]
  message?: string
}

// The most tool calls to show. The older ones scroll away.
const MAX_STEPS = 10

// The progress of the Claude fix: the rounds, the last tool calls, and the
// summaries of Claude.
export function AgentPanel({
  agent,
  spinner,
  onPress,
}: {
  agent: AgentState
  spinner: string
  onPress: (key: string) => void
}) {
  const title = {
    running: `${spinner} Claude is fixing the conflicts`,
    done: '✓ Claude fixed the conflicts',
    failed: '✗ Claude stopped',
  }[agent.status]
  const titleColor = {
    running: color.accent,
    done: color.green,
    failed: color.red,
  }[agent.status]
  return (
    <box
      border
      borderColor={titleColor}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
      flexShrink={0}
    >
      <text fg={titleColor}>
        <strong>{title}</strong>
      </text>
      {agent.steps.slice(-MAX_STEPS).map((step, i) =>
        step.kind === 'round' ? (
          <text key={i} fg={color.yellow} wrapMode="none" truncate>
            {step.text}
          </text>
        ) : (
          <text key={i} fg={color.dim} wrapMode="none" truncate>
            {'  '}
            {step.text}
          </text>
        ),
      )}
      {agent.summaries.map((summary, i) => (
        <text key={`s${i}`} fg={color.text} wrapMode="word" marginTop={1}>
          {summary}
        </text>
      ))}
      {agent.message && (
        <text
          fg={agent.status === 'failed' ? color.red : color.green}
          wrapMode="word"
          marginTop={1}
        >
          {agent.message}
        </text>
      )}
      <box marginTop={1}>
        <HintBar
          items={
            agent.status === 'running'
              ? [{ key: 'escape', label: 'stop Claude' }]
              : [
                  { key: 'p', label: 'push' },
                  { key: 'u', label: 'undo' },
                  { key: 'escape', label: 'close' },
                ]
          }
          onPress={onPress}
        />
      </box>
    </box>
  )
}
