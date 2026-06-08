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

// true → handheld phone (not tablet/desktop). Android tablets omit "Mobile" and
// iPads report as iPad/Mac, so this stays false for them — hover effects that
// need a real cursor are kept on tablets, dropped on phones.
export const PHONE =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPod|Windows Phone/i.test(navigator.userAgent) ||
    (/Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent)))

// Render-resolution cap: phones lie about devicePixelRatio (2.5–3.5), which
// quadruples fragment work for no visible gain.
// Retina MacBooks report 2, which quadruples bloom/fill work for little visible
// gain under heavy postprocessing — cap it so the descent stays smooth.
export const DPR: [number, number] = LOW ? [1, 1.25] : [1, 1.6]

// fbm octaves baked into shaders
export const FBM = LOW ? 3 : 5
