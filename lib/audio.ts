// Shared across both canvases (hero + section scene) so the live FFT can drive
// any component regardless of which <Canvas> it lives in.
export const audioState: {
  analyser: AnalyserNode | null
  playing: boolean
} = {
  analyser: null,
  playing: false,
}
