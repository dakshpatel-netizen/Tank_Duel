# Networking Architecture

## Authoritative Model
- **Transport**: Single Express HTTP + `ws` WebSocket server on port 3000 (`/ws`).
- **Simulation Rate**: 30 Hz fixed timestep (`1/30s`) on the server (`shared/sim.ts`).
- **Snapshot Broadcast**: 20 Hz (`WorldSnapshot`) + immediate discrete `SimEvent[]` packets (`fired`, `hit`, `explosion`, `tank_destroyed`, `pickup`, `flag_event`, etc.).

## Client Prediction & Interpolation
- Local player inputs are sampled at 30 Hz, stamped with `seq`, sent via WebSocket, and simulated locally via `stepTank`.
- Upon receiving authoritative snapshots, unacknowledged inputs (`seq > lastProcessedSeq`) are replayed (`reconcileLocalTank`), smoothly decaying visual correction error (`renderErrorOffset`) when divergence is under 2m.
- Remote tanks are interpolated 100ms behind live server arrivals with bounded extrapolation up to 200ms.

## Room Lifecycle & Hardening
- 4-character room codes excluding ambiguous characters (`I, O, L, 0, 1`).
- Optional room password, host migration if host disconnects, 60s reconnect token grace (`playerToken`), kick 60s ban cooldown.
- Packet size capped at 4 KB; rate limiting drops bursts >120 msgs/s and closes connections >200 msgs/s.
- Debug query flags: `?lag=100&loss=5` simulates network latency and packet loss on the client.
