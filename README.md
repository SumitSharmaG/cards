# Dehla Pakad — GitHub, Render & Vercel Setup

Real-time four-player Dehla Pakad built with React/Vite, Node.js, Express and Socket.io.

## What is working

- Four manually claimed seats: North, East, South, West
- Teams: North + South versus East + West
- Protected room code + PIN
- Host-only game start
- Anti-clockwise turn order
- Follow-suit validation and trump winner calculation
- Standard capture, Village `2 or 4 Dehlas`, and Strict Pairs modes
- Server-authoritative shuffle, cut, trump reveal, deal and card play
- Reconnect identity stored in the browser
- In-memory RAM storage only; restarting the backend clears all rooms

## Folder layout

```text
dehla-pakad-game/
├── frontend/   # Vercel / static React app
└── backend/    # Render / long-running Socket.io server
```

## 1. Run locally

Open two terminals:

### Terminal 1 — backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs at `http://localhost:10000`.

### Terminal 2 — frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set this in `frontend/.env` for local play:

```env
VITE_BACKEND_URL=http://localhost:10000
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

To verify code before pushing:

```bash
cd backend && npm run typecheck && npm test && npm run build
cd ../frontend && npm run typecheck && npm run build
```

## 2. Push to GitHub

Create a new empty GitHub repository, then run from the folder that contains `frontend/` and `backend/`:

```bash
git init
git add frontend backend README.md
git commit -m "Initial Dehla Pakad multiplayer game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `.env`, `node_modules`, `dist`, or the generated ZIP.

## 3. Deploy backend to Render

1. In Render, choose **New → Web Service**.
2. Connect the GitHub repository.
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add environment variables:

   ```env
   CLIENT_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
   BASE_PATH=
   ```

   Render supplies `PORT` automatically; do not hard-code it.
5. Deploy and copy the Render URL, for example:

   ```text
   https://dehla-pakad-api.onrender.com
   ```

6. Test the backend:

   ```text
   https://dehla-pakad-api.onrender.com/health
   ```

The backend uses RAM only. Rooms disappear when the Render service restarts or sleeps, which is expected for this version. Socket.io needs a continuously reachable Web Service, not a Render Static Site.

## 4. Deploy frontend to Vercel

1. In Vercel, choose **Add New → Project** and import the same GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Vercel should detect Vite. Use:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add the environment variable:

   ```env
   VITE_BACKEND_URL=https://dehla-pakad-api.onrender.com
   ```

5. Deploy.

The frontend derives the Socket.io endpoint as:

```text
https://dehla-pakad-api.onrender.com/socket.io
```

Do not add `/socket.io` to `VITE_BACKEND_URL`; provide only the backend origin.

## 5. CORS and production checklist

- `CLIENT_ORIGIN` on Render must exactly match the Vercel origin, including `https://` and without a trailing slash.
- If you add a custom frontend domain, update `CLIENT_ORIGIN` to that domain and redeploy Render.
- If you add a custom backend domain, update `VITE_BACKEND_URL` in Vercel and redeploy the frontend.
- Both sites must use HTTPS in production.
- Browser refresh is safe on the landing page; an active room can only be recovered while the same backend process still has the room in RAM.

## Game flow

1. Host chooses a name, room PIN and capture style.
2. Friends enter room code + PIN.
3. Every player claims one seat.
4. Host starts the ritual.
5. Dealer taps the deck at least three times and finishes the shuffle.
6. Dealer's right-side player holds to cut.
7. Host starts the trump reveal and deal.
8. Each player receives 13 private cards.
9. The server accepts only legal follow-suit moves and advances the anti-clockwise turn.

## Limitations

- No database or persistent accounts.
- Maximum four players per room.
- A room is lost when the backend process restarts.
- No spectators or bots.