# Logistics System — Jordan / China / Iraq

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
| Proxy      | Nginx (rate limiting, security headers, HTTPS)  |
| Container  | Docker + docker-compose                         |

---

## Modules

| Module | Description |
|--------|-------------|
| Clients | Core module — all others link to it. Auto-generated client codes per branch |
| Invoices | PI / CI / PL / SC + Price Offer. PDF export (EN + AR) |
| Containers | Sea (20GP/40FT/40HQ) + Air booking. Status flow. Link to agent |
| Shipping Agents | Price quotes (SEA/AIR/LCL), quick-reference prices, market board display |
| Clearance Agents | Fee tracking (clearance, service, transport, handling, storage) |
| Market Board | Live USD exchange rates, agent prices, top clients — TV display + management page |
| Users | Role-based access: super_admin / admin / branch_manager / staff / viewer |
| Company | Company settings, logo, stamp for PDF generation |

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
│   │   ├── api/v1/          # Route handlers (auth, users, clients, invoices,
│   │   │                    #   containers, shipping_agents, clearance_agents,
│   │   │                    #   market, company, branches)
│   │   ├── core/            # Security, JWT, permissions, rate limiter
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── utils/           # PDF generator, currency fetcher, number-to-words
│   │   ├── config.py        # Settings from .env
│   │   ├── database.py      # Engine + session + Base
│   │   └── main.py          # FastAPI app, CORS, security headers, routers
│   ├── alembic/             # DB migrations
│   ├── scripts/seed.py      # Seeds branches + first super_admin
│   ├── requirements.txt
│   ├── Dockerfile           # Dev
│   └── Dockerfile.prod      # Production (multi-stage, non-root)
├── frontend/
│   └── src/
│       ├── components/      # UI components (layout, ui, invoice, dashboard)
│       ├── pages/           # All page components
│       ├── services/        # API client functions
│       ├── store/           # Zustand stores (auth, UI)
│       ├── hooks/           # useAuth, useRTL
│       ├── i18n/            # en.json + ar.json translations
│       └── types/           # Shared TypeScript types
├── nginx/
│   └── nginx.conf           # Rate limiting, security headers, SSL template
├── docker-compose.yml       # Local dev (DB + backend + frontend)
├── docker-compose.prod.yml  # Production (AWS Aurora, nginx, no DB container)
└── .env                     # Secrets — never commit
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
python scripts/seed.py          # creates branches + first admin
uvicorn app.main:app --reload --port 8000
```

Default credentials: `admin@logistics.jo` / `Admin@1234`

### 3. Run frontend locally
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:5173

### 4. API Docs (dev only)
Open: http://localhost:8000/api/docs

---

## Environment Variables (`.env`)

```env
APP_ENV=development
SECRET_KEY=change-this-in-production-use-openssl-rand-hex-32
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

POSTGRES_USER=logistics_user
POSTGRES_PASSWORD=logistics_pass
POSTGRES_DB=logistics_db
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://logistics_user:logistics_pass@db:5432/logistics_db

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
ALLOWED_HOSTS=*

CURRENCY_API_KEY=your-exchangerate-api-key
MIN_PASSWORD_LENGTH=8
```

---

## Production Deployment

```bash
# 1. Set .env with production values:
#    APP_ENV=production
#    DATABASE_URL=postgresql://user:pass@aurora-endpoint:5432/logistics_db
#    SECRET_KEY=$(openssl rand -hex 32)
#    ALLOWED_ORIGINS=https://yourdomain.com
#    ALLOWED_HOSTS=yourdomain.com

# 2. Place SSL certs (Let's Encrypt / ACM):
#    nginx/certs/fullchain.pem
#    nginx/certs/privkey.pem

# 3. Run migrations against Aurora:
cd backend
export DATABASE_URL="postgresql://..."
alembic upgrade head

# 4. Build and start all services:
docker compose -f docker-compose.prod.yml up -d --build
```

**Services started:** nginx (80/443) → backend (internal :8000). No DB container — uses Aurora.

---

## Build Log

### Phase 1 — Docker + PostgreSQL ✓
- `docker-compose.yml` with PostgreSQL 16, backend, frontend services
- `docker-compose.prod.yml` for production (no DB — AWS Aurora)
- `.env` configuration
- **Fix:** Docker Compose v2 manual install on Kali Linux via GitHub releases

### Phase 2 — Backend Core ✓
- All ORM models, Alembic migrations, FastAPI app skeleton
- **Fix:** `pillow==11.0.0` for Python 3.13; `alembic/script.py.mako` template fix

### Phase 3 — Auth System ✓
- JWT (access + refresh), bcrypt, role hierarchy, seed script
- **Fix:** Replaced `passlib` with direct `bcrypt` calls (passlib broken on Python 3.13)

### Phase 4 — Client Module ✓
- Full CRUD, soft delete, auto client codes (JO-0001, CN-0001, IQ-0001), branch assignment

### Phase 5 — Invoicing System ✓
- PI / CI / PL / SC / Price Offer, WeasyPrint PDF (EN + AR), company settings
- Auto invoice numbering, item images, stamp uploads

### Phase 6 — Container Booking ✓
- Sea + air bookings, status flow (BOOKING → DELIVERED), link to client + agent
- Auto booking numbers: `SEA-2026-0001` / `AIR-2026-0001`

### Phase 7 — Shipping Agents ✓
- Quote model (SEA_FCL/AIR/LCL), all charge types, auto quote numbers
- Compare endpoint: cheapest-first sorted by route/mode/type

### Phase 8 — Clearance Agents ✓
- Full CRUD, fee fields, `total_fixed_fees` computed field

### Phase 9 — Market Board ✓
- Live USD rates (exchangerate-api.com), 30-min DB cache, 6 currencies
- Top clients by revenue (CI invoices) + by shipments (containers)
- Agent quick prices + active quote comparison — single `/board` endpoint (no auth)

### Phase 10 — Frontend Foundation ✓
- Vite + React + TypeScript + Tailwind CSS
- Zustand state management, React Query, axios with JWT interceptor
- i18n RTL/LTR (Arabic/English), Cairo + Inter fonts
- All API services, protected routes, login page

### Phase 11 — Frontend Theme ✓
- Premium dark design system: brand colors, card shadows, animations
- Sidebar (collapsible, RTL-aware, mobile overlay), TopBar (lang toggle, avatar)
- Table (skeleton loading, empty state with icon), Modal (mobile slide-up, Escape key)
- StatCard with color variants, Dashboard with live stats + welcome message

### Phase 12 — Frontend Pages ✓
All pages implemented:
- Dashboard, Clients, Invoices, Containers, Shipping Agents, Clearance Agents
- Market Board, Users, Company Settings, Login
- TV Display (Portal) — fullscreen, no auth, auto-refresh 30s

### Phase 13 — Market Board TV Display ✓
- Portal page: currency ticker (animated), exchange rates, top clients
- Agent quick prices (container + air), detailed active quotes
- Live clock + date in Arabic, company branding

### Phase 14 — Security Hardening ✓
- **Rate limiting:** 10 req/min on `/login` (brute force protection), 30 req/s general API
- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` (production)
- **CORS:** explicit methods/headers, no wildcard in production
- **TrustedHostMiddleware:** production-only host validation
- **Password validation:** minimum length enforced on create + update
- **Nginx:** rate limiting zones, `server_tokens off`, CSP header, hidden backend headers
- **Limiter module:** extracted to `app/core/limiter.py` (no circular imports)

### Phase 15 — Production Config ✓
- `Dockerfile.prod` (backend): multi-stage build, Python 3.13-slim, non-root user (uid 1001)
- `Dockerfile.prod` (frontend): `npm ci --omit=dev`, `VITE_API_URL` ARG
- `docker-compose.prod.yml`: healthchecks, `--proxy-headers`, nginx with SSL template
- `nginx.conf`: rate limiting zones (login: 5/min, api: 30/s), gzip, static asset caching, HTTPS template

---

## Restart Backend (Local Dev)

```bash
cd ~/Desktop/logistics-system-jo/backend
source .venv/bin/activate
export SECRET_KEY="dev-secret-key"
export DATABASE_URL="postgresql://logistics_user:logistics_pass@localhost:5432/logistics_db"
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/api/docs
Admin: `admin@logistics.jo` / `Admin@1234`
