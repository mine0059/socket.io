<div align="center">
  <div>
    <img src="https://img.shields.io/badge/-Node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/-Express_5-000000?style=for-the-badge&logo=Express&logoColor=white" />
    <img src="https://img.shields.io/badge/-Socket.IO-010101?style=for-the-badge&logo=Socket.io&logoColor=white" />
    <br/>
    <img src="https://img.shields.io/badge/-HTML5_Canvas-E34F26?style=for-the-badge&logo=HTML5&logoColor=white" />
    <img src="https://img.shields.io/badge/-Bootstrap_5-7952B3?style=for-the-badge&logo=Bootstrap&logoColor=white" />
  </div>
</div>

# Orb Game — Real-Time Multiplayer Canvas Game

A real-time multiplayer game built on Node.js, Express, and Socket.IO. Players connect, enter a name, and are dropped into a shared 5000×5000 world alongside thousands of orbs and other live players — all synced at 30 frames per second via a server-driven tick-tock game loop. This project was built as a deliberate step up from raw WebSocket work, exploring what a higher-level real-time library unlocks specifically for game architecture.

---

## What This Game Does

Players move their circular avatar across an HTML5 Canvas world by moving their mouse. They absorb smaller orbs to grow, slow down over time as they get bigger, and can absorb other players if they're larger than them. Every player's position, score, and collision state is calculated authoritatively on the server and broadcast to all clients 30 times per second.

**Core mechanics:**

- **Name-based login** — Players enter a name through a Bootstrap modal before joining the game world.
- **Server-authoritative movement** — The client sends `tock` events (mouse vector direction) to the server. The server moves the player, enforces world boundaries, and owns all state.
- **Orb system** — 5,000 randomly placed orbs fill the world at all times. When a player absorbs an orb, the server replaces it at a new random location and broadcasts the swap to all clients via `orbSwitch`.
- **Player-vs-player collision** — When two players overlap, the larger absorbs the smaller. The loser is removed from the game world and the event is announced to all players via `playerAbsorbed`.
- **Live leaderboard** — Every score event triggers an `updateLeaderBoard` broadcast, so all players always see a current, sorted ranking.
- **Tick-tock game loop** — The server emits a `tick` event to all players in the `game` room 30 times per second, carrying the full player state array. Clients use this to re-render the world.
- **Socket.IO rooms** — Players are placed into a `game` room on `init`. Broadcasts are scoped to the room rather than blasted to every connected socket on the server.
- **Acknowledgement callbacks** — The `init` event uses `emitWithAck` / `ackCallback` so the server sends the initial orb array and the player's index directly back to the joining client as a guaranteed, one-time reply.

---

## Why Socket.IO Over Raw `ws`

This project follows on from a previous real-time project built with the bare `ws` library. That project covered the raw WebSocket protocol — the TCP upgrade handshake, frame construction, ping/pong heartbeating, and pub/sub from scratch. Moving to Socket.IO here was a deliberate comparison.

| Feature | `ws` (previous project) | Socket.IO (this project) |
|---|---|---|
| Reconnection | Manual | Built-in, automatic |
| Rooms / namespacing | Custom `Map<id, Set<ws>>` | Native `socket.join()` / `io.to()` |
| Broadcast targeting | Loop over subscribers | `io.to('room').emit()` |
| Acknowledgements | Custom protocol | Native `emitWithAck` |
| Fallback transport | None (WebSocket only) | HTTP long-polling fallback |
| Client-side library | Browser's native `WebSocket` | Must use Socket.IO client |
| Protocol overhead | Minimal (raw frames) | Extra Socket.IO message envelope |

The key tradeoff: **Socket.IO pays a small overhead cost to remove a large amount of manual plumbing.** For a game that needs rooms, scoped broadcasts, acknowledgements, and auto-reconnection, Socket.IO is the pragmatic choice. For a system where you specifically need spec-compliant WebSocket frames that any client can consume (a monitoring dashboard, a public feed), `ws` is the right tool.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| HTTP Framework | Express 5 |
| Real-time | Socket.IO v4 |
| Client rendering | HTML5 Canvas API |
| UI / Modals | Bootstrap 5 |
| Dev server | `node --watch` (no nodemon needed) |

---

## Project Structure

```
socketIO/
├── public/                  # Static client files served by Express
│   ├── index.html           # Game UI — canvas, Bootstrap modals, leaderboard
│   ├── css/
│   │   └── styles.css       # Game-specific styles
│   ├── images/              # Canvas background assets
│   └── js/
│       ├── uiStuff.js       # Canvas setup, modal logic, player object, game start flow
│       ├── canvasStuff.js   # Canvas draw loop — renders players and orbs each frame
│       └── socketStuff.js   # All Socket.IO client logic — init, tock, tick, events
├── src/
│   ├── server.js            # Entry point — wires Express static serving + Socket.IO
│   └── socket/
│       ├── server.js        # Socket.IO server — all game event handlers, game loop
│       └── player/
│           ├── checkCollisions.js          # AABB + Pythagoras circle collision detection
│           └── classes/
│               ├── Player.js               # Wraps socketId, PlayerConfig, PlayerData
│               ├── PlayerConfig.js         # Per-player private state (speed, zoom, vectors)
│               ├── PlayerData.js           # Per-player public state (position, radius, score)
│               └── Orb.js                  # Orb with random position and colour
├── .env                     # PORT and HOST configuration
├── .gitignore
└── package.json
```

---

## How It Works — Architecture Overview

Express and Socket.IO share a single HTTP server. Express serves the static `public/` folder. Socket.IO attaches to the same server and intercepts WebSocket upgrade requests automatically — no second port, no separate process.

```
Browser
  │
  ├── HTTP GET / ──────────────► Express → serves public/index.html + assets
  │
  └── WebSocket (socket.io) ──► Socket.IO Server
                                    │
                                    ├── connection
                                    │     └── init ──► joins 'game' room, spawns player
                                    │           └── tock ──► moves player, checks collisions
                                    │                 ├── orbSwitch (if orb hit)
                                    │                 ├── playerAbsorbed (if player hit)
                                    │                 └── updateLeaderBoard
                                    │
                                    └── setInterval (33ms)
                                          └── tick ──► broadcasts all playerData to 'game' room
```

---

## Game Loop Detail

The tick-tock loop is the heartbeat of the game:

- **`tock` (client → server):** Every 33ms, each client emits its current mouse direction vector `{ xVector, yVector }` to the server.
- **Server processes tock:** The server moves that player, runs collision detection against all orbs and all other players, and emits any resulting events (`orbSwitch`, `playerAbsorbed`, `updateLeaderBoard`).
- **`tick` (server → all clients):** Independently, the server fires `setInterval` every 33ms and broadcasts the full `playersForUsers` array to the entire `game` room. Every client re-draws the canvas frame from this data.

This keeps the server as the single source of truth. Clients never move themselves — they only suggest movement and receive the result.

---

## Collision Detection

Two-stage collision detection is used for performance — the cheap test runs first, and the expensive one only runs when necessary:

1. **AABB (Axis-Aligned Bounding Box)** — A square bounds check. If the bounding squares don't overlap, there is no collision. This eliminates the vast majority of checks cheaply.
2. **Pythagorean circle test** — Only if the AABB check passes, the actual circular distance is calculated with `√((Δx)² + (Δy)²)`. A collision is confirmed if the distance is less than the sum of both radii.

---

## Getting Started

### Prerequisites

- Node.js v20 or later

### 1. Clone the repository

```bash
git clone https://github.com/mine0059/socket.io.git
cd socket.io
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root (or the defaults in code will apply):

```env
PORT=8000
HOST=0.0.0.0
```

### 4. Start the development server

```bash
npm run dev
```

The game will be live at **[http://localhost:8000](http://localhost:8000)**.

To run without file watching:

```bash
npm start
```

---

## Key Things Learnt

This project built directly on top of raw WebSocket knowledge from the previous `ws`-based project, and extended it into production-grade real-time game territory:

- **Socket.IO vs bare WebSockets** — Understanding what Socket.IO adds (rooms, namespaces, acknowledgements, auto-reconnection, long-polling fallback) and what it costs (client library dependency, protocol overhead, loss of raw frame control).
- **Sharing one HTTP server between Express and Socket.IO** — Attaching Socket.IO to an `http.createServer(app)` instance so both transports live on the same port, using the correct pattern rather than the common mistake of calling `app.listen()` directly.
- **Socket.IO rooms** — Using `socket.join('game')` and `io.to('game').emit(...)` to scope broadcasts to only players who are actively in the game, rather than every connected socket.
- **Acknowledgement callbacks (`emitWithAck`)** — Sending the initial orbs array and player index back to a joining client as a guaranteed point-to-point reply, distinct from a broadcast.
- **Server-authoritative game loop** — Designing a game where all state lives on the server. Clients send intentions (mouse vectors), the server decides what actually happens, and the result is pushed to everyone.
- **The tick-tock pattern** — Separating inbound `tock` events (client-driven, per-player movement) from outbound `tick` broadcasts (server-driven, world state) and understanding why this split keeps the game consistent across all clients.
- **Two-phase collision detection (AABB + Pythagoras)** — Using a cheap rectangular bounding box check to cull non-colliding objects before running the more expensive circular distance formula.
- **CORS configuration in Socket.IO** — Whitelisting specific origins on the Socket.IO server to control which clients are allowed to establish a connection.
- **ES Modules strict mode implications** — Understanding that `"type": "module"` in `package.json` enables strict mode, which means implicit global variables (a common JavaScript pitfall) become hard crashes instead of silent bugs.
- **`__dirname` in ESM** — Reconstructing `__dirname` using `import.meta.url` + `fileURLToPath` since it is not available natively in ES Module scope, and using it to correctly resolve the `public/` static folder path.
- **Serving static files with Express** — Using `express.static()` to serve the `public/` folder, and understanding how path resolution works relative to the entry point file.
- **OOP game entity design** — Splitting player state into `Player` (identity), `PlayerConfig` (private/server-only state like speed and vectors), and `PlayerData` (public state broadcast to all clients) to control exactly what data is shared across the network.

---

## License

ISC
