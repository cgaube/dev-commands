import { useLayoutEffect, useRef, useState } from 'react'
import { measureElement, type DOMElement } from 'ink'

// Measure a Box's rendered height after flexbox layout so its content can size
// itself to the space it was actually given, instead of hard-coding row budgets
// from border/padding counts. Attach the returned ref to a Box; the second value
// is that box's current inner height in rows (0 until the first measurement).
//
// The layout effect runs after every commit with no dependency array: it only
// updates state when the measured height changes, so it converges in one extra
// render and stays idle afterwards.
export function useMeasuredHeight() {
  const ref = useRef<DOMElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    if (!ref.current) return
    const measured = measureElement(ref.current).height
    setHeight((h) => (h === measured ? h : measured))
  })

  return [ref, height] as const
}
