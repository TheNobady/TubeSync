# 🍿 TubeSync — Cinematic Watch Party Platform

![TubeSync Cover](frontend/public/favicon.ico) <!-- Placeholder, you can update this to an actual screenshot later! -->

**Live Demo:** [https://tube-sync-gamma.vercel.app/](https://tube-sync-gamma.vercel.app/)

TubeSync is a premium, real-time synchronized YouTube watch party application. It features a stunning "Cinematic" UI with dual light/dark themes, role-based controls (Host, Mod, Participant, Viewer), and instant video synchronization powered by WebSockets.

---

## 🚀 Tech Stack

### Frontend (Vercel)
* **Framework:** Next.js 15 (App Router)
* **Auth:** NextAuth (Google OAuth with custom JWT strategy)
* **Styling:** Pure, semantic CSS with CSS Variables (No Tailwind!)
* **Real-time:** `@stomp/stompjs` and `sockjs-client`
* **Video:** YouTube IFrame API

### Backend (Render)
* **Framework:** Spring Boot 3.5 (Java 17)
* **Real-time:** Spring WebSocket (STOMP messaging)
* **Security:** Spring Security (Custom JWT validation filter)
* **Database Access:** Spring Data JPA / Hibernate

### Database (Supabase)
* **Engine:** PostgreSQL
* **Connections:** Supabase Connection Pooler (Session Mode)

---

## ✨ Core Features
* **Perfect Synchronization:** Instantly syncs video state, timestamps, and play/pause events across all clients.
* **Cinematic UI:** Netflix-style theater mode featuring full-width seek bars, ghost buttons, and dark video bezels. 
* **Dual Themes:** Global toggles for "Cinematic Dark" and "Warm Cinema" light mode without layout jumps.
* **Role Management:**
  * **HOST (👑):** Total control. Can change videos, promote/demote users, kick users, and control playback.
  * **MOD:** Can manage users and chat, but cannot change the main video.
  * **PARTICIPANT:** Can watch and chat. No video controls.
  * **VIEWER:** Can only watch. Chat input and playback controls are fully disabled.
* **Social Sidebar:** Real-time chat with role-based color coding and dynamic participant list.

---

## 🛠️ Local Development

### 1. Prerequisites
- Node.js ≥ 18.x
- Java 17 (LTS) & Maven
- PostgreSQL (Local or Remote)

### 2. Clone the Repository
```bash
git clone https://github.com/TheNobady/TubeSync.git
cd TubeSync
```

### 3. Backend Setup
Create a PostgreSQL database named `tubesync`.
```bash
cd backend
mvn spring-boot:run
```
*(The backend runs on `http://localhost:8080`)*

### 4. Frontend Setup
```bash
cd frontend
cp .env.example .env.local 
npm install
npm run dev
```
*(The frontend runs on `http://localhost:3000`)*

---

## 🌍 Production Deployment Guide

This project is configured as a Monorepo and uses Docker for the backend. It is optimized for deployment on **Supabase** (DB), **Render** (Backend), and **Vercel** (Frontend).

### Phase 1: Database (Supabase)
1. Create a project on [Supabase](https://supabase.com).
2. Go to **Project Settings > Database > Connection String > JDBC**.
3. Enable **Connection Pooling** and set it to **Session Mode**.
4. Copy the connection string. It will look like: `jdbc:postgresql://[region].pooler.supabase.com:6543/postgres`.

### Phase 2: Backend (Render)
1. Go to [Render](https://render.com) and create a **New Web Service**.
2. Connect your GitHub repository.
3. Set the **Root Directory** to `backend`.
4. Render will automatically detect the included `Dockerfile` and build the Spring Boot app.
5. Add the following **Environment Variables**:
   * `DATABASE_URL`: Your Supabase JDBC URL *(no `?user=` params)*
   * `DATABASE_USERNAME`: e.g., `postgres.xxxx`
   * `DATABASE_PASSWORD`: Your database password
   * `NEXTAUTH_SECRET`: A strong 32-character random string.
   * `CORS_ALLOWED_ORIGINS`: `https://tube-sync-gamma.vercel.app`
6. Deploy and copy the provided `.onrender.com` URL.

### Phase 3: Frontend (Vercel)
1. Go to [Vercel](https://vercel.com) and create a **New Project**.
2. Import the GitHub repository.
3. Set the **Root Directory** to `frontend`.
4. Ensure the **Framework Preset** is set to **Next.js**.
5. Add the following **Environment Variables**:
   * `NEXT_PUBLIC_API_URL`: `https://your-backend.onrender.com/api`
   * `NEXT_PUBLIC_WS_URL`: `https://your-backend.onrender.com/ws`
   * `NEXTAUTH_URL`: `https://tube-sync-gamma.vercel.app`
   * `NEXTAUTH_SECRET`: *(Must exactly match the backend secret!)*
   * `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   * `GOOGLE_CLIENT_SECRET`: Your Google OAuth Secret
6. Deploy!

### Phase 4: Final Security Checks
* Go to your **Google Cloud Console**.
* Update the OAuth **Authorized JavaScript origins** to include `https://tube-sync-gamma.vercel.app`.
* Update the **Authorized redirect URIs** to include `https://tube-sync-gamma.vercel.app/api/auth/callback/google`.
