# QA Report — Tank Duel Online

## Automated Simulation Tests (`shared/sim.test.ts`)
- **Map Connectivity**: BFS reachability verified across all 6 maps × 3 size presets (18 configurations).
- **Tank Class Physics & Dash**: Verified Scout speed cap and Q/E sideways dash burst vs Heavy speed.
- **Heavy Frontal Armor**: Verified 15% damage reduction within front 60° arc vs full flank damage.
- **Spawn Shield & Safe Zone**: Verified 2s spawn shield blocks weapon damage while shrinking safe-zone DoT bypasses shields.
- **LTS Mutual Kill Replay**: Verified simultaneous final-tank kills award a round draw and advance to the next round.
- **CTF Flag Carry & Return**: Verified flag pickup, 15% carrier slow, and instant home return on friendly touch.
- **Protocol Sanitization**: Verified XSS stripping, length clamping, and duplicate nickname numbering.

## Build & Browser Verification
- TypeScript, Vite production bundle, esbuild server bundle, and ESLint checks verified after final edits.
- Interactive Playwright browser inspection verified Title, Main Menu, Lobby (Map Preview Card, Garage 3D turntable, Match Setup), and Practice 3D arena gameplay (`?autostart=1`) with HUD, movement, firing, and zero console errors.
