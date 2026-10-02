# 🏏 IPL Auction Arena — Monorepo

Real-time multiplayer IPL-style cricket auction web application built with **React**, **Vite**, **Tailwind CSS**, **Node.js**, **Express**, **Socket.IO**, and **Prisma ORM**.

---

## 📁 Repository Structure

```
d:/IPL Aution/
├── package.json              # Monorepo root scripts & concurrent runners
├── .gitignore                # Global git ignore configuration
├── README.md                 # Setup & verification guide
├── server/                   # Backend Express & Socket.IO server
│   ├── package.json          # Node.js backend dependencies
│   ├── .env.example          # Backend environment variable template
│   ├── .env                  # Backend active environment variables
│   ├── prisma/
│   │   └── schema.prisma     # Prisma ORM datasource & client configuration
│   └── src/
│       ├── server.js         # HTTP & Socket.IO server setup
│       └── routes/
│           └── health.js     # GET /api/health endpoint
└── client/                   # Frontend React + Vite SPA
    ├── package.json          # React frontend dependencies
    ├── vite.config.js        # Vite dev server configuration & API proxy
    ├── tailwind.config.js    # Tailwind CSS design system config
    ├── postcss.config.js     # PostCSS plugins setup
    ├── index.html            # Vite HTML template
    ├── .env.example          # Frontend environment template
    ├── .env                  # Frontend active environment variables
    └── src/
        ├── main.jsx          # React app entry point with Router
        ├── App.jsx           # App layout & health check container
        ├── index.css         # Tailwind directives & glassmorphism theme
        ├── services/
        │   ├── api.js        # Axios instance configured for REST API
        │   └── socket.js     # Socket.IO client connection manager
        └── components/
            └── HealthCheckStatus.jsx # Real-time REST & Socket verification card
```

---

## 🚀 Quick Setup & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Step 1: Install Dependencies
Run the install command from the root directory to install packages for root, `/server`, and `/client`:

```bash
npm run install:all
```
*(On Windows PowerShell if script execution is restricted: `npm.cmd run install:all`)*

---

## 🏃 Running Development Servers

### Option A: Run Both Client & Server Concurrently (Recommended)
From the root folder, execute:

```bash
npm run dev
```
*(Windows: `npm.cmd run dev`)*

This launches:
- **Express Backend**: `http://localhost:5000`
- **Vite React Frontend**: `http://localhost:5173`

### Option B: Run Packages Individually

- **Backend Server Only**:
  ```bash
  npm run dev:server
  # OR inside /server:
  npm run dev
  ```

- **Frontend Client Only**:
  ```bash
  npm run dev:client
  # OR inside /client:
  npm run dev
  ```

---

## 🧪 Verifying Client-to-Server Health Check

1. **Verify Backend Health Check via Browser / Curl**:
   Navigate to `http://localhost:5000/api/health` in your browser.
   Expected JSON response:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-09-13T08:30:00.000Z",
     "service": "IPL Auction Arena API",
     "version": "1.0.0",
     "message": "Server is running healthy"
   }
   ```

2. **Verify Frontend Integration**:
   Open `http://localhost:5173` in your browser.
   - Look at the **System Health & Connectivity** dashboard card.
   - **REST API Endpoint**: Should display badge **Healthy** with response metadata.
   - **Socket.IO Server**: Should display badge **Connected** with Socket ID.
   - Click **Send Socket Ping** to measure real-time websocket ping/pong latency.

---

## 📋 Environment Configuration

### Backend (`/server/.env`)
```env
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ipl_auction?schema=public"
```

### Frontend (`/client/.env`)
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```
