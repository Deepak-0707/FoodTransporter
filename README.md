# 🍱 FoodBridge — Phase 1

> Connecting event organizers and NGOs to reduce food wastage.

FoodBridge is a full-stack web application where **Organizers** post surplus food from events and **NGOs** find and collect it before it expires.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Running with Docker](#running-with-docker)
- [Deployment](#deployment)
  - [Backend → Render](#backend--render)
  - [Frontend → Vercel](#frontend--vercel)
- [API Reference](#api-reference)
- [CI/CD](#cicd)

---

## Features

### Authentication
- Register and login with **JWT** (7-day tokens)
- Two roles: **ORGANIZER** and **NGO**
- Passwords hashed with **bcrypt** (10 salt rounds)

### Organizer
- Create food surplus events with title, description, location (lat/lng), quantity, and expiry time
- View, edit, and delete your own events
- Role-based dashboard showing your events and stats

### NGO
- Browse all available events
- View event details including organizer contact
- Map view to find nearby pickups

### Map
- Interactive **Leaflet + OpenStreetMap** map
- Custom colour-coded markers (green = available, orange = expiring soon, red = critical, grey = expired)
- Popup with event title, quantity, and expiry time
- Click-through to full event detail

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS        |
| Backend    | Node.js, Express                    |
| Database   | PostgreSQL via **Supabase**         |
| Auth       | JWT + bcrypt                        |
| Maps       | Leaflet + OpenStreetMap             |
| DevOps     | Docker, GitHub Actions              |
| Hosting    | Render (backend), Vercel (frontend) |

---

## Project Structure

```
foodbridge/
├── backend/
│   ├── config/
│   │   └── db.js              # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js  # register, login
│   │   └── eventController.js # CRUD for events
│   ├── middleware/
│   │   └── auth.js            # JWT verify + role guard
│   ├── routes/
│   │   ├── auth.js
│   │   └── events.js
│   ├── server.js              # Express app entry point
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EventCard.jsx
│   │   │   ├── EventForm.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── PageLayout.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── EventListPage.jsx
│   │   │   ├── EventDetailPage.jsx
│   │   │   ├── CreateEventPage.jsx
│   │   │   ├── EditEventPage.jsx
│   │   │   └── MapViewPage.jsx
│   │   ├── services/
│   │   │   └── api.js         # Axios instance + API calls
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── vercel.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI pipeline
├── schema.sql                 # PostgreSQL schema
├── docker-compose.yml         # Local full-stack runner
├── render.yaml                # Render deploy blueprint
└── README.md
```

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Supabase free tier recommended)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/foodbridge.git
cd foodbridge
```

### 2. Set up the database

Go to [supabase.com](https://supabase.com), create a free project, then run the schema:

```bash
# In your Supabase SQL editor, paste and run the contents of:
schema.sql
```

Copy the **connection string** from: Project Settings → Database → Connection string → URI.

### 3. Configure backend environment

```bash
cd backend
cp .env.example .env
# Edit .env and fill in DATABASE_URL, JWT_SECRET
```

### 4. Start the backend

```bash
npm install
npm run dev
# API running at http://localhost:5000
```

### 5. Configure frontend environment

```bash
cd ../frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000
```

### 6. Start the frontend

```bash
npm install
npm run dev
# App running at http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable       | Description                                  | Example                                      |
|----------------|----------------------------------------------|----------------------------------------------|
| `PORT`         | Express server port                          | `5000`                                       |
| `NODE_ENV`     | Environment                                  | `development`                                |
| `DATABASE_URL` | PostgreSQL connection string                 | `postgresql://user:pass@host:5432/dbname`    |
| `JWT_SECRET`   | Secret key for signing JWTs                  | `a-very-long-random-string`                  |
| `CLIENT_URL`   | Frontend URL for CORS                        | `http://localhost:5173`                      |

### Frontend (`frontend/.env`)

| Variable        | Description              | Example                                |
|-----------------|--------------------------|----------------------------------------|
| `VITE_API_URL`  | Backend API base URL     | `http://localhost:5000`                |

---

## Database Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `schema.sql`
3. Go to **Project Settings → Database → URI** and copy the connection string
4. Paste it as `DATABASE_URL` in your backend `.env`

> **Note:** Supabase requires `?sslmode=require` — the backend automatically sets `ssl: { rejectUnauthorized: false }` in production mode.

---

## Running with Docker

Make sure Docker and Docker Compose are installed. Create a `backend/.env` file first.

```bash
# From the project root
docker compose up --build
```

| Service   | URL                      |
|-----------|--------------------------|
| Frontend  | http://localhost:3000    |
| Backend   | http://localhost:5000    |

To stop:
```bash
docker compose down
```

---

## Deployment

### Backend → Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo, set **Root Directory** to `backend`
4. Set **Build Command:** `npm ci`
5. Set **Start Command:** `node server.js`
6. Add environment variables in the Render dashboard:
   - `DATABASE_URL` — your Supabase connection string
   - `JWT_SECRET` — a strong random string
   - `CLIENT_URL` — your Vercel frontend URL (set after frontend deploy)
   - `NODE_ENV` — `production`

Or use the **Blueprint** (automatic):
```bash
# render.yaml is already configured — just connect your repo in Render
```

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo, set **Root Directory** to `frontend`
3. Framework preset: **Vite**
4. Add environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://foodbridge-backend.onrender.com`)
5. Deploy

> After deploying frontend, go back to Render and update `CLIENT_URL` to your Vercel URL.

---

## API Reference

### Auth

| Method | Endpoint        | Body                              | Auth | Description         |
|--------|-----------------|-----------------------------------|------|---------------------|
| POST   | `/auth/register`| `name, email, password, role`     | No   | Create account      |
| POST   | `/auth/login`   | `email, password`                 | No   | Login, get JWT      |

### Events

| Method | Endpoint        | Body / Query                      | Auth     | Description                    |
|--------|-----------------|-----------------------------------|----------|--------------------------------|
| GET    | `/events`       | `?mine=true` (optional)           | Required | List all events                |
| GET    | `/events/:id`   | —                                 | Required | Get single event               |
| POST   | `/events`       | `title, latitude, longitude, quantity, expiry_time, [description]` | ORGANIZER | Create event |
| PUT    | `/events/:id`   | Any event fields                  | ORGANIZER (owner) | Update event |
| DELETE | `/events/:id`   | —                                 | ORGANIZER (owner) | Delete event |
| GET    | `/health`       | —                                 | No       | Health check                   |

All protected endpoints require:
```
Authorization: Bearer <your_jwt_token>
```

### Response format
```json
// Success
{ "message": "...", "event": { ... } }
{ "events": [ ... ] }

// Error
{ "error": "Human-readable error message" }
```

---

## CI/CD

GitHub Actions runs automatically on every push to `main` or `develop`:

1. **Backend job** — installs deps, runs ESLint
2. **Frontend job** — installs deps, runs ESLint, runs `vite build`, uploads `dist/` as artifact
3. **Docker job** — builds both Docker images to verify they compile correctly

View workflow: `.github/workflows/ci.yml`

---

## Roadmap (Phase 2+)

- [ ] NGO booking / claim system
- [ ] Real-time notifications (WebSockets)
- [ ] Email alerts for expiring events
- [ ] Food splitting across multiple NGOs
- [ ] Admin dashboard
- [ ] Mobile app (React Native)

---

## License

MIT — free to use and modify.
