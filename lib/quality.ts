// Device-capability tier, detected once on the client. Drives geometry detail,
// shader octaves, postprocessing and render resolution so phones / weak GPUs get
// a lighter scene while desktops keep the full look.
function detect(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const mobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|Silk/i.test(ua)
  const cores = navigator.hardwareConcurrency ?? 8
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8
  return mobile || cores <= 4 || mem <= 4
}

// true → low-power device (mobile or weak desktop)
export const LOW = detect()

// Render-resolution cap: phones lie about devicePixelRatio (2.5–3.5), which
// quadruples fragment work for no visible gain.
export const DPR: [number, number] = LOW ? [1, 1.5] : [1, 2]

// fbm octaves baked into shaders
export const FBM = LOW ? 3 : 5
