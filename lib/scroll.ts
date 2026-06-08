export const scrollState = {
  progress: 0,
  velocity: 0,
  direction: 0, // -1 up, 1 down, 0 idle
  scrollY: 0,
}

// Lightweight pub/sub so React components (e.g. canvas frameloop gates) can react
// to scroll without polling. Fired from LenisProvider on every scroll tick.
type ScrollListener = (progress: number) => void
const listeners = new Set<ScrollListener>()

export function onScroll(fn: ScrollListener) {
  listeners.add(fn)
  fn(scrollState.progress)
  return () => { listeners.delete(fn) }
}

export function emitScroll() {
  for (const fn of listeners) fn(scrollState.progress)
}
