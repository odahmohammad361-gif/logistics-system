# Logistics System — Jordan/China/Iraq Branches

Full-stack logistics management system for shipping, trading, and wholesale operations.
Arabic-first UI with English toggle. Built with FastAPI + React + PostgreSQL.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Backend    | FastAPI (Python 3.13), SQLAlchemy 2, Alembic    |
| Database   | PostgreSQL 16 (Docker local / AWS Aurora prod)  |
| Frontend   | React + TypeScript + Vite + Tailwind CSS        |
| Auth       | JWT (access + refresh tokens), bcrypt           |
| PDF        | WeasyPrint                                      |
| Container  | Docker + docker-compose                         |

---

## Modules

1. Client System (core — all modules depend on it)
2. Invoicing — PI / CI / PL / SC + Price Offer form
3. Container Booking — sea (20GP/40FT/40HQ) + air (per KG)
4. Shipping Agents — price quotations comparison
5. Clearance Agents
6. Market Board — live USD rates, agent price comparison, top clients (TV display)
7. User Management — roles: super_admin / admin / branch_manager / staff / viewer

---

## Branches

| Code | Country |
|------|---------|
| JO   | Jordan  |
| CN   | China   |
| IQ   | Iraq    |

---

## Project Structure

```
logistics-system-jo/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers
│   │   ├── core/            # Security, dependencies, permissions
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── utils/           # PDF, currency, email helpers
│   │   ├── config.py        # Settings from .env
│   │   ├── database.py      # Engine + session + Base
│   │   └── main.py          # FastAPI app + routers
│   ├── alembic/             # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
├── nginx/
├── docker-compose.yml       # Local dev
├── docker-compose.prod.yml  # Production (AWS Aurora, no DB container)
└── .env                     # Secrets (never commit)
```

---

## Quick Start (Local Dev)

### Prerequisites
- Docker + Docker Compose v2
- Python 3.13 + venv
- Node.js 20+

### 1. Start the database
```bash
docker compose up db -d
```

### 2. Run backend locally
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export SECRET_KEY="your-dev-secret"
export DATABASE_URL="postgresql://logistics_user:logistics_pass@localhost:5432/logistics_db"

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Create first admin user
```bash
python scripts/seed.py
```
Default credentials: `admin@logistics.jo` / `Admin@1234`

### 4. API Docs
Open: http://localhost:8000/api/docs

---

## Environment Variables (`.env`)

```env
APP_ENV=development
SECRET_KEY=change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

POSTGRES_USER=logistics_user
POSTGRES_PASSWORD=logistics_pass
POSTGRES_DB=logistics_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://logistics_user:logistics_pass@db:5432/logistics_db

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
CURRENCY_API_KEY=your-exchangerate-api-key
```

---

## Build Log — Phase by Phase

### Phase 1 — Docker + PostgreSQL ✓
**What was done:**
- `docker-compose.yml` with `db` (PostgreSQL 16), `backend`, `frontend` services
- `docker-compose.prod.yml` for production (no DB — uses AWS Aurora)
- `.env` with all environment variables
- PostgreSQL container runs healthy on port 5432

**Fixes:**
- `docker-compose-v2` and `docker-compose-plugin` packages not available on Kali Linux
- Fix: manual install via curl from GitHub releases
  ```bash
  sudo curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  ```

---

### Phase 2 — Backend Core ✓
**What was done:**
- `app/config.py` — Pydantic Settings, loads from `../.env` or `.env`
- `app/database.py` — SQLAlchemy engine, SessionLocal, Base (DeclarativeBase)
- All ORM models: `Branch`, `User`, `Client`, `ShippingAgent`, `ClearanceAgent`,
  `Invoice`, `InvoiceItem`, `Container`, `MarketRate`
- `app/main.py` — FastAPI app, CORS, rate limiting, all routers registered
- `alembic/env.py` and `alembic.ini` — wired to app models and `.env`
- All 9 business tables + `alembic_version` created in PostgreSQL

**Fixes:**
- `pillow==10.3.0` fails on Python 3.13 → upgraded to `pillow==11.0.0` and bumped all packages
- `SECRET_KEY` required by Pydantic but missing when running alembic from `backend/` dir
  → Fix: `env_file=("../.env", ".env")` in config, or `export SECRET_KEY=...` before alembic
- `alembic/script.py.mako` was empty → migration file generated with no content
  → Fix: wrote the standard Mako template into the file, deleted broken migration, re-ran autogenerate
- First autogenerate produced empty migration (models not yet written when it ran)
  → Fix: `alembic stamp base`, delete empty file, re-run after models were written

---

### Phase 3 — Auth System ✓
**What was done:**
- `app/core/security.py` — `hash_password`, `verify_password` (bcrypt), `create_access_token`, `create_refresh_token`, `decode_token` (JWT HS256)
- `app/core/permissions.py` — role hierarchy: viewer < staff < branch_manager < admin < super_admin
- `app/core/dependencies.py` — `get_current_user` (Bearer token guard), `require_role(role)` factory
- `app/api/v1/auth.py` — `POST /login`, `POST /refresh`, `GET /me`
- `app/api/v1/users.py` — admin CRUD for users (list, create, get, update, delete)
- `app/schemas/user.py` — LoginRequest, TokenResponse, RefreshRequest, UserCreate, UserUpdate, UserResponse
- `scripts/seed.py` — seeds 3 branches (JO/CN/IQ) + first super_admin user
- Default admin: `admin@logistics.jo` / `Admin@1234`

**Fixes:**
- `passlib[bcrypt]==1.7.4` broken on Python 3.13 + bcrypt 4.x (`__about__` removed)
  → Fix: removed passlib entirely, replaced with direct `bcrypt` calls in `security.py`
- `pydantic[email]` not installed → `EmailStr` fails at startup
  → Fix: changed `pydantic==2.9.2` to `pydantic[email]==2.9.2` in requirements.txt

---

---

## ⏸ SESSION PAUSE — Resume Point

**Stopped after:** Phase 3 complete, Phase 4 not started.

**Next step:** Phase 4 — Client Module (CORE)
- Full CRUD API for clients (`app/api/v1/clients.py`)
- Auto-generated `client_code` (e.g. `JO-0001`)
- Search/filter by name, branch, country
- Assign client to branch + `created_by` user
- Pydantic schemas with Arabic fields (`app/schemas/client.py`)

**Server state when paused:**
- DB running: `docker compose up db -d` (already healthy)
- Backend was running locally (not in Docker — Docker Hub unreachable)
- To restart backend:
  ```bash
  cd ~/Desktop/logistics-system-jo/backend
  source .venv/bin/activate
  export SECRET_KEY="dev-secret-key-for-migrations"
  export DATABASE_URL="postgresql://logistics_user:logistics_pass@localhost:5432/logistics_db"
  uvicorn app.main:app --reload --port 8000
  ```
- API docs: http://localhost:8000/api/docs
- Admin login: `admin@logistics.jo` / `Admin@1234`

---

## Production Deployment (AWS)

**AWS Aurora PostgreSQL:**
- Change `DATABASE_URL` in `.env` to point to your Aurora cluster endpoint
- Run: `docker compose -f docker-compose.prod.yml up -d`
- Migrations: `alembic upgrade head` (run once from backend with Aurora URL)

**Supported AWS OS:** Ubuntu (recommended) or Windows Server
