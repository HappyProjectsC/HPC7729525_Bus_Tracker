# College Bus Tracking System

Production-oriented MERN stack app: **MongoDB**, **Express**, **React (Vite)**, **Socket.IO**, **JWT + refresh cookies**, **Leaflet + OpenStreetMap** (no paid map API keys).

## Prerequisites

- Node.js 20+
- MongoDB (local or [Atlas free tier](https://www.mongodb.com/pricing))

## Quick start

### 1. Database

Start MongoDB locally, e.g. `mongodb://127.0.0.1:27017/college_bus_tracker`, or create an Atlas cluster and copy the connection string.

### 2. Server

```bash
cd server
cp .env.example .env
# Edit .env — set MONGODB_URI and long random JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (32+ chars each)
npm install
npm run seed
npm run dev
```

Default seed admin (override with env vars `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):

- Email: `admin@college.edu`
- Password: `Admin12345!`

### 3. Client

```bash
cd client
cp .env.example .env.development
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to `http://localhost:5000`. **Socket.IO** uses `VITE_SOCKET_URL` (default `http://localhost:5000` in `.env.development`).

## Roles

| Role    | Capabilities |
|--------|----------------|
| **Admin** | CRUD buses, routes, stops; create drivers/admins; assign driver→bus, bus→route, student→bus; live fleet map. |
| **Driver** | Start/stop tracking; GPS sent ~every 8s via Socket.IO with HTTP fallback. |
| **Student** | Register; view assigned bus on map, ETAs, optional web push for approaching stops. |

Students self-register. Admins create drivers (and other admins) from **Admin → Users**.

## Web push (optional)

Generate VAPID keys (free, local):

```bash
npx web-push generate-vapid-keys
```

Put `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `server/.env`. Restart the server. Students can use **Enable stop alerts (push)** on the student dashboard.

## Production notes

- Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true` behind HTTPS reverse proxy.
- Build client: `cd client && npm run build`; serve `client/dist` with nginx or the same Express app.
- Run server: `cd server && npm run build && npm start`.
- Configure `CORS_ORIGIN` to your real frontend origin(s).
- MongoDB: ensure indexes exist (defined in Mongoose schemas); use **W** connection string options for Atlas.

## API overview

- `POST /api/auth/register` — student only  
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`  
- `/api/admin/*` — admin CRUD and assignments  
- `/api/driver/*` — driver bus and tracking  
- `GET /api/student/my-bus` — bus, route, stops, ETAs  
- `POST /api/location` — driver REST fallback for GPS  
- Socket.IO: `driver:location`, `subscribe:bus`, `subscribe:admin`, `bus:location`  

## License

MIT (adjust as needed for your institution).
