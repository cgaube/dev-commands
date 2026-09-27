import { useEffect, useState } from 'react'
import { useStdout } from 'ink'

// Track the terminal's dimensions so the UI can fill the screen and reflow when
// the window is resized.
export function useTerminalSize(): { cols: number; rows: number } {
  const { stdout } = useStdout()
  const [size, setSize] = useState({
    cols: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  })

  useEffect(() => {
    if (!stdout) return
    const onResize = () => setSize({ cols: stdout.columns, rows: stdout.rows })
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  return size
}
