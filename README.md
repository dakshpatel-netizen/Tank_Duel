# Tank Duel Online

A 3D browser multiplayer tank battle game powered by Three.js, React, and an authoritative Node.js WebSocket server (`ws`).

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.
- Use `?autostart=1` to jump directly into an offline Practice match against bots.
- Use `?room=CODE` to prefill the Join Room code from an invite link.
- Use `?debug=1` to display FPS, ping, prediction error, and entity count in battle.

## Production Build & Start

```bash
npm run build
npm run start
```

## Features
- **3 Tank Classes**: Scout (fast + Q/E sideways dash), Standard (balanced), Heavy (150 HP + 15% frontal armor).
- **6 Stylized Maps**: Desert Outpost, Industrial Yard, Frozen Lake, Forest Maze, Twin Bases, Crater Hill — each scalable to Small (0.75x), Medium (1.0x), and Large (1.4x).
- **5 Game Modes**: Free For All, Team Deathmatch, Last Tank Standing (Best of 5 + Shrinking Safe Zone), Capture the Flag, King of the Hill.
- **13 Power Box Items**: 6 timed buffs and 7 special stored weapons (Homing, Cluster, Guided, Bouncing, EMP, Mines, Airstrike).
- **Authoritative Server**: 30 Hz simulation tick, 20 Hz state snapshots, client-side prediction & reconciliation, remote interpolation, bot backfill, and 60s reconnect grace.

## Tests

```bash
npm run test
```
