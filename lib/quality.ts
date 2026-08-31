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

// Max framebuffer size, in rendered pixels. A fixed dpr cap ignores how
// physically large the window is: on a 4K/ultrawide monitor the CSS canvas is
// huge, so the framebuffer (width × height × dpr²) balloons and the
// postprocessing chain (EffectComposer + Bloom mip pyramid) allocates several
// full-res render targets → the scene eats a lot of VRAM for no visible gain.
// Bounding the total pixel count keeps VRAM constant on any screen size. Tuned so
// a retina laptop lands ~1.6 dpr (the sweet spot under heavy bloom).
const BUDGET = LOW ? 2_600_000 : 3_400_000

// Given the current CSS viewport size, return the render dpr that respects the
// budget. Two goals:
//
//  1. VRAM: never render more than BUDGET pixels (so big monitors stay cheap).
//  2. Zoom safety: driving this off the *measured* CSS size (see useBudgetDpr)
//     rather than a fixed dpr cap is what keeps zoom-OUT safe — when the layout
//     viewport balloons to thousands of px, cssPixels balloons with it and
//     fromBudget shrinks in lockstep, so the framebuffer can never exceed BUDGET.
//
// Mobile keeps a hard ratio cap: phones report devicePixelRatio 2.5–3.5, which
// quadruples fragment work for no visible gain.
export function targetDprFor(cssWidth: number, cssHeight: number): number {
  const cssPixels = Math.max(1, cssWidth * cssHeight)
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  const fromBudget = Math.sqrt(BUDGET / cssPixels)

  if (LOW) return Math.min(1.25, dpr, fromBudget)
  // Floor at 0.5 so extreme zoom-out doesn't render an unreadably mushy frame.
  return Math.max(0.5, Math.min(dpr, fromBudget))
}

export function targetDpr(): number {
  if (typeof window === 'undefined') return LOW ? 1.25 : 1.6
  return targetDprFor(window.innerWidth, window.innerHeight)
}

// fbm octaves baked into shaders
export const FBM = LOW ? 3 : 5
