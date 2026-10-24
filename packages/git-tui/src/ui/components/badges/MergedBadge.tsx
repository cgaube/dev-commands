import { PrStatusBadge } from './PrStatusBadge'

// For a stack branch whose PR gh did not list. Looks like the PR chip.
export function MergedBadge() {
  return <PrStatusBadge status="merged" />
}
