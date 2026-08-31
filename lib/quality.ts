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

// true → any mobile/tablet (touch device). Lets us tell a weak desktop apart
// from a phone/tablet when a cut should hit one but not the other.
export const MOBILE =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|Silk/i.test(navigator.userAgent || '')

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
//
// An [min, max] tuple only clamps devicePixelRatio — it ignores how physically
// large the window is. On a 4K/ultrawide monitor the CSS canvas is huge, so the
// framebuffer (width × height × dpr²) balloons and the postprocessing chain
// (EffectComposer + Bloom mip pyramid) allocates several full-res render targets
// → the scene eats a lot of VRAM for no visible gain. So instead of a fixed cap
// we bound the *total pixel count*: the effective max dpr shrinks as the window
// grows, keeping the framebuffer roughly constant on any screen size.
export function dprCap(): [number, number] {
  const baseMax = LOW ? 1.25 : 1.6
  if (typeof window === 'undefined') return [1, baseMax]

  // Target framebuffer size, in rendered pixels. ~1080p rendered at baseMax —
  // the point past which extra resolution stops being visible under bloom.
  const budget = LOW ? 2_600_000 : 5_300_000
  const cssPixels = window.innerWidth * window.innerHeight
  // dpr that spends exactly the budget on this window; may drop below 1 on very
  // large screens (R3F renders smaller and CSS-upscales — invisible under bloom).
  const fromBudget = Math.sqrt(budget / cssPixels)

  const max = Math.min(baseMax, fromBudget)
  // Never let min exceed max, or R3F clamps devicePixelRatio upward past budget.
  return [Math.min(1, max), max]
}

// Initial render-resolution cap from the first window size. Detected on the
// client; SSR falls back to the base cap and R3F recomputes on mount. Once
// mounted, <AdaptiveDpr /> recomputes this on resize / zoom so the framebuffer
// stays at the budget size instead of ballooning when the window grows.
export const DPR: [number, number] = dprCap()

// fbm octaves baked into shaders
export const FBM = LOW ? 3 : 5
