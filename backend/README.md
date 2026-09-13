# Dehla Pakad Backend

Node.js + Express + Socket.io backend for the Dehla Pakad multiplayer card game.

## Included

The backend contains the server-authoritative multiplayer game:

- Standard 52-card deck with shuffle, cut, draw, and deal support
- Four positional seats and fixed teams: North/South vs East/West
- Anti-clockwise turn order
- Follow-suit validation
- Trump and lead-suit trick winner calculation
- Center table pile
- Standard, Village (`2 or 4 Dehlas`), and Strict Pairs capture modes
- In-memory `RoomManager` with empty-room cleanup support
- Protected room creation and PIN-checked joining
- Manual seat claiming with host-only round start
- Dealer shuffle taps, dealer-right-side cut, trump reveal, timed dealing, and card play
- Reconnect identity support while the server process remains alive
- Render-compatible HTTP + Socket.io server with `/health`

## Local setup

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run build
npm start
```

The server listens on `PORT` (default `10000`).

## Render setup

Create a **Web Service** from the GitHub repository:

- Root directory: `backend`
- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables:
  - `CLIENT_ORIGIN=https://your-frontend.vercel.app`
  - `BASE_PATH=` (leave empty)

The backend binds to `0.0.0.0` and reads Render's injected `PORT`. Use a Render service that supports long-running WebSocket connections; do not use a static site for this backend.

After deploy, verify:

```text
https://your-backend.onrender.com/health
```

Expected response:

```json
{"ok":true,"service":"dehla-pakad-backend"}
```