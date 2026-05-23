# TubeSync

## Stack
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + NextAuth
- **Backend**: Spring Boot 3.5 + Spring WebSocket (STOMP) + Spring Data JPA
- **Database**: PostgreSQL

## Project Structure
```
TubeSync/
├── frontend/    # Next.js app
└── backend/     # Spring Boot app
```

## Getting Started

### Prerequisites
- Node.js ≥ 18.x
- Java 17 (LTS)
- Maven
- PostgreSQL 14+

### Frontend
```bash
cd frontend
cp .env.example .env.local   # fill in your secrets
npm install
npm run dev                  # runs on http://localhost:3000
```

### Backend
```bash
cd backend
# Create the database first:
# psql -U postgres -c "CREATE DATABASE tubesync;"
mvn spring-boot:run          # runs on http://localhost:8080
```

## Environment Variables
See `frontend/.env.example` for all required environment variables.

The `NEXTAUTH_SECRET` value must be identical in both `frontend/.env.local` and `backend/application.yml` for JWT validation to work.
