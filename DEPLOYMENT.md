# 🚀 IPL Auction Arena — Production Deployment Guide

This guide provides step-by-step instructions to deploy the IPL Auction Arena application across **Vercel** (Frontend), **Render** (Backend Server + WebSockets), and **Neon** (PostgreSQL Database).

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    Client["Vercel Frontend (React + Vite)\nhttps://ipl-auction-arena.vercel.app"]
    Server["Render Backend (Node.js + Express + Socket.IO)\nhttps://ipl-auction-backend.onrender.com"]
    DB["Neon PostgreSQL (Serverless DB)\nPooler: pgbouncer mode"]

    Client -->|REST & WebSockets| Server
    Server -->|Prisma ORM| DB
```

---

## 🗄️ Step 1: Database Setup (Neon PostgreSQL)

1. Sign up/Log in to **[Neon](https://neon.tech)**.
2. Create a new project: `ipl-auction-db`.
3. Retrieve your connection strings from the Neon Console dashboard:
   - **Pooled Connection String** (with PgBouncer mode enabled):
     ```text
     postgres://user:password@ep-sample-poolerer.eastus2.azure.neon.tech/ipl_auction?sslmode=require&pgbouncer=true
     ```
   - **Direct Connection String** (Direct connection for Prisma migrations):
     ```text
     postgres://user:password@ep-sample.eastus2.azure.neon.tech/ipl_auction?sslmode=require
     ```
4. Run Database Migrations & Initial Player/Team Seeding from your terminal:
   ```bash
   cd server
   # Set temporary env variables for migration & seeding
   export DATABASE_URL="YOUR_POOLED_NEON_URL"
   export DIRECT_URL="YOUR_DIRECT_NEON_URL"

   # Run production migrations & seed
   npx prisma migrate deploy
   npm run seed
   ```

---

## 🖥️ Step 2: Backend Deployment (Render)

1. Log in to **[Render](https://render.com)**.
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Set service configurations:
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
5. Configure Environment Variables under **Environment**:

| Key | Description | Example Value |
| :--- | :--- | :--- |
| `PORT` | Port exposed by Render | `5000` |
| `CLIENT_URL` | Allowed Vercel Frontend origin(s) | `https://ipl-auction-arena.vercel.app,http://localhost:5173` |
| `DATABASE_URL` | Neon Pooled Connection String | `postgres://user:pass@ep-poolerer.neon.tech/ipl_auction?sslmode=require` |
| `DIRECT_URL` | Neon Direct Connection String | `postgres://user:pass@ep-direct.neon.tech/ipl_auction?sslmode=require` |

6. Click **Create Web Service**. Note your deployed backend URL (e.g. `https://ipl-auction-backend.onrender.com`).

---

## 🌐 Step 3: Frontend Deployment (Vercel)

1. Log in to **[Vercel](https://vercel.com)**.
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository.
4. Set project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
5. Configure Environment Variables:

| Key | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Deployed Render Backend REST Base URL | `https://ipl-auction-backend.onrender.com/api` |
| `VITE_SOCKET_URL` | Deployed Render Socket.IO Server URL | `https://ipl-auction-backend.onrender.com` |

6. Click **Deploy**. Vercel will build the React app and deploy it to a live production URL.

---

## 🧪 Step 4: Cross-Network Verification Checklist

After deployment, test the live app across **2 separate devices on different networks** (e.g., Desktop on Home Wi-Fi vs Smartphone on 4G/5G Cellular Data):

- [ ] **Health Check**: Visit `https://ipl-auction-backend.onrender.com/api/health` in browser. Expect `{"status":"OK"}`.
- [ ] **Room Creation**: Host creates an auction room from Device #1 (Vercel URL).
- [ ] **Cross-Network Join**: Device #2 connects over mobile data using the 6-character room code.
- [ ] **Real-Time Sockets**: Verify `participantJoined` and team claims sync instantaneously on both devices.
- [ ] **Live Bids & Sound**: Submit bids on Device #2; verify Device #1 updates bid price, resets the radial countdown ring, and triggers the gavel sound cue.
- [ ] **Results Export**: Complete auction and open `/results/:code` to verify squad lists and copy summary text.
