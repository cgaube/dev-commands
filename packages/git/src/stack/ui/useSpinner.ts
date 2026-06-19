import { useEffect, useState } from 'react'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!active) {
      setFrame(0)
      return
    }
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80)
    return () => clearInterval(id)
  }, [active])

  return active ? FRAMES[frame] : ''
}
