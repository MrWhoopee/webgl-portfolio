# City model

Drop your exported Meshy city here as **`city.glb`**:

1. Open https://www.meshy.ai/s/xkjC3o
2. Export → **GLB** (binary glTF)
3. Save it as `public/models/city.glb`

Until the file exists, `CyberCity` renders a procedural skyline as a fallback
(via `components/ErrorBoundary.tsx`). Fit/placement is tunable at the top of
`components/three/CityModel.tsx` (`TARGET_HEIGHT`, `OFFSET_X`, `OFFSET_Z`).
