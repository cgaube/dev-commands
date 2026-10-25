import { useRef } from 'react'
import { useBoxMetrics, type DOMElement } from 'ink'

// Measure a Box's rendered height after flexbox layout so its content can size
// itself to the space it was actually given, instead of hard-coding row budgets
// from border/padding counts. Attach the returned ref to a Box; the second value
// is that box's current inner height in rows (0 until the first measurement).
// Ink updates the height when the layout changes, e.g. on a terminal resize.
export function useMeasuredHeight() {
  const ref = useRef<DOMElement>(null)
  const { clientHeight } = useBoxMetrics(ref)
  return [ref, clientHeight] as const
}
