import { useEffect, useState } from 'react'
import { color } from './theme'

// The frames of the spinner: a dot that turns around a braille cell.
export const SPINNER = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']

const FRAME_MS = 80
// The empty steps between two sweeps of the shimmer, so that it rests a
// moment.
const SHIMMER_REST = 10

// A counter that goes up each frame while `active` is true. All the
// animations use it, so that they move together.
export function useFrame(active: boolean): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setFrame((f) => f + 1), FRAME_MS)
    return () => clearInterval(id)
  }, [active])
  return frame
}

export function spinnerAt(frame: number): string {
  return SPINNER[frame % SPINNER.length]
}

// Work in progress: the spinner, then the text with a light that moves from
// left to right over it. Use it inside a <text>.
// A trailing "…" goes away: the spinner already tells that work runs.
export function Activity({ text, frame }: { text: string; frame: number }) {
  const label = text.replace(/…$/, '')
  const cycle = label.length + SHIMMER_REST
  const head = frame % cycle
  return (
    <>
      <span fg={color.accent}>{spinnerAt(frame)} </span>
      {[...label].map((char, i) => {
        const distance = Math.abs(i - head)
        return (
          <span key={i} fg={distance <= 2 ? color.text : color.dim}>
            {distance === 0 ? <strong>{char}</strong> : char}
          </span>
        )
      })}
    </>
  )
}
