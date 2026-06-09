// Shared across both canvases (hero + section scene) so the live FFT can drive
// any component regardless of which <Canvas> it lives in.
export const audioState: {
  analyser: AnalyserNode | null
  playing: boolean
  // Set by AudioManager once mounted; the entry gate calls it from inside the
  // click handler so play()/resume() fire within the user gesture (Safari-safe).
  start: (() => void) | null
} = {
  analyser: null,
  playing: false,
  start: null,
}
