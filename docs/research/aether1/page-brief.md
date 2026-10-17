# aether1.ai — page brief

Source: https://aether1.ai/?ref=landing.love (Webflow page + custom three.js bundle by OFF+BRAND).
Local route: `/` → `src/app/page.tsx` → `src/components/sites/aether1/`.

## Structure
- Fixed `main` pinned over 10 viewport heights of scroll (Lenis: wheelMultiplier 0.25, syncTouch).
- Five stacked sections (hero, sound, craft, controls, power); copy revealed with a CSS mask driven by `--progress`.
- Snap stops (progress): 0, .125, .25, .375, .5, .742, .81, 1. At >0.99 a circular wipe loops into a second scene copy and resets scroll to 0; scrolling up hard at the top loops backwards.
- WebGL: `scene-258.glb` (Draco) with baked clips (camera, case, earbuds, `actions` empties that toggle projected labels); scrubbed by scroll progress. Wave plane, GPGPU particles, dashed orbit lines, fluid-cursor distortion, post plane with scroll-indicator ring.
- UI: glass menu panel (anchors to snap stops), sound toggle with sine wave, trailing "click to enable sound" cursor, "Ask Aether" assistant, specs indicator, loader with tag cloud.

## Type
Manrope 400/500 (54px titles, 14px desc at 1440), Azeret Mono 300 (labels). `html { font-size: 100vw / 1440 * 10 }`, 990 and 390 layouts below.

## Assets
`public/sites/aether1/` — model, textures, Draco decoder, audio, fonts, noise, avatars (all from `aether1.itsoffbrand.io/assets` and the Webflow CDN).

## Not reproduced
- `/specs`, `/preorder` routes (links point to the source).
- Hosted AI agent (`aether-two-kappa.vercel.app/api/agent`): replaced by `src/app/api/aether/route.ts` with canned answers built from page copy; answer media uses the two avatar images.
- IndexedDB answer history (kept in memory per session); easter-egg / FWA scenes.
