# Session: 3D Hero Section + Docker Plan
**Date:** 2026-03-17 (13:25–16:47 UTC)
**Commit:** `66fa3c8` — Add interactive 3D retro Macintosh to hero section

## What happened

### 3D Hero Section
- Added a 3D retro Macintosh computer to the landing page hero using React Three Fiber + drei.
- Built entirely from primitives (no external .glb models) — RoundedBox, cylinders, etc.
- CRT screen uses drei's `<Html>` to render "YieldOS 1.0" with live agent log entries (yield accrued, swaps, inference).
- Back of the computer has vents, ports (ADB, serial, power), label, and handle.
- OrbitControls for user rotation.

### Iterations
1. First tried abstract glass icosahedron with `MeshTransmissionMaterial` — hung at "Loading", too heavy.
2. Simplified to standard materials — worked but looked generic.
3. Pivoted to retro Macintosh concept — first version looked like a Game Boy.
4. Refined proportions, added back panel detail, OrbitControls. Final version committed.

### Docker Plan (entered plan mode)
- Explored `apps/agent/` Docker setup (Dockerfile, docker-compose, init script, skills).
- User clarified: both Locus and Venice keys are acquired autonomously (not manual).
- Scoped plan down to local Docker only — dashboard wiring deferred.

## Decisions
- React Three Fiber + drei for 3D (not Spline)
- Procedural geometry, no external models
- `MeshTransmissionMaterial` abandoned for standard materials
- Agent Docker setup is separate from web app
- Venice autonomous key flow: VVV stake → sign token → POST for API key
