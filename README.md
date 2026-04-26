# Logistics System — Jordan / China / Iraq

Full-stack logistics management system for shipping, clearance, trading, invoicing, clients, and operations.

The UI is Arabic-first with English support. The backend is FastAPI, the frontend is React + TypeScript, and the database is PostgreSQL.

---

## Current Status

The system is active and under fast development. Shipping agent and clearance agent pricing were recently expanded, and the next major work area is the container section.

Current focus before the next round:

- Keep shipping agent prices connected to carrier, container size, port, warehouse, and validity dates.
- Keep clearance agent prices connected to clearance type, country/port, container size, and carrier when needed.
- Prepare the container profile to become the main place where booking, shipping price, clearance price, and later final cost equations connect together.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI, SQLAlchemy, Alembic, Python 3.13 |
| Database | PostgreSQL 16 locally, AWS Aurora/PostgreSQL in production |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Auth | JWT access + refresh tokens, bcrypt |
| PDF | WeasyPrint |
| Proxy | Nginx |
| Containers | Docker + Docker Compose |

---

## Main Modules

| Module | Current Behavior |
| --- | --- |
| Clients | Client profiles, branch assignment, generated client codes |
| Invoices | PI, CI, PL, SC, price offers, PDF export in Arabic and English |
| Containers | Sea and air booking cards, clickable card profile navigation, status flow, linked client and agent data |
| Shipping Agents | Agent cards and profiles, weekly/current sea rates, FCL/LCL per container size, air rates, origin fees, history of expired offers |
| Clearance Agents | Agent cards and profiles, permanent editable clearance rates, edit log, multi-quote price update |
| Market Board | Currency rates, agent prices, top clients, public TV view |
| Users | Role-based access |
| Company | Company info, logo, stamp, warehouses |

---

## Shipping Agent Pricing

Shipping agent pricing is now split between current active offers and history.

Sea price fields include:

- Carrier name.
- Port of loading and port of discharge.
- Loading warehouse.
- Effective date and expiry date.
- Sealing date and vessel date.
- FCL buy/sell prices by container size: `20GP`, `40GP`, `40HQ`.
- LCL buy/sell per CBM by container size.
- Origin fees from loading warehouse to loading port to Aqaba/Jordan side: loading workers, B/L, trucking, and other fees.
- Markup application and editable current rates.

Air price fields include:

- Multiple carrier offers.
- Warehouse, origin/destination airport style flow.
- Buy/sell per kg.
- Minimum and maximum load.
- Transit days.

Expired weekly shipping offers should appear in history, while current offers stay in current rates.

---

## Clearance Agent Pricing

Clearance agents now use profile-style cards, similar to shipping agents.

Clearance prices are permanent editable rates, not weekly offers. Changes are tracked in an edit log.

Each clearance quote can define:

- Sea or air clearance.
- Country and port/airport.
- Container size when sea clearance depends on container size.
- Carrier when a clearance price changes by carrier.
- Clearance fees.
- Import/export card percentage.
- Transportation route and cost.
- Delivery authorization fees.
- Inspection ramp fees for sea.
- Port inspection fees for sea.
- Buy and sell values, with percentage markup support.

The add/update clearance price modal supports multiple quote entries in the same page.

---

## Container Section Baseline

The container section currently shows booking cards for sea and air cargo. Cards are clickable and open the container profile directly.

The next big container work should connect:

- Selected shipping agent current carrier rate.
- Selected clearance agent rate.
- Container size.
- Carrier.
- Ports and warehouse.
- Sea/air booking type.
- Future final cost equation after Aqaba/Jordan and destination-side fees.

This README section is intentionally kept as a baseline before the next major container redesign.

---

## Branches

| Code | Country |
| --- | --- |
| JO | Jordan |
| CN | China |
| IQ | Iraq |

---

## Project Structure

```text
logistics-system-jo/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # FastAPI route handlers
│   │   ├── core/            # Auth, security, permissions, rate limiter
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── utils/           # PDF, currency, helper utilities
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/             # Database migrations
│   ├── scripts/             # Seed and utility scripts
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Dockerfile.prod
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── package.json
│   └── Dockerfile.prod
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env
```

---

## Local Development

Start the Docker services:

```bash
docker compose up -d --build
```

Local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API docs: http://localhost:8000/api/docs
- PostgreSQL: localhost:5433

Run migrations manually if needed:

```bash
docker exec logistics_backend alembic upgrade head
```

Default seed user:

```text
admin@logistics.jo
Admin@1234
```

---

## Frontend Commands

```bash
cd frontend
npm install
npm run dev
npm run build
```

---

## Backend Commands

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

---

## Environment Variables

Example development values:

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

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8000
ALLOWED_HOSTS=*

CURRENCY_API_KEY=your-exchangerate-api-key
MIN_PASSWORD_LENGTH=8
```

Never commit real `.env` secrets.

---

## Production / VPS Deployment

The current production compose is configured for development access by IP on port `8000`, because ports `80` and `443` are used by another official website on the same server.

Production app URL example:

```text
http://SERVER_IP:8000/
```

Deploy from the server:

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker exec logistics_backend alembic upgrade head
docker compose -f docker-compose.prod.yml restart backend nginx
```

If the frontend still shows an old UI after rebuild, clear the frontend build volume and rebuild:

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm logistics-system_frontend_dist
docker compose -f docker-compose.prod.yml up -d --build
docker exec logistics_backend alembic upgrade head
docker compose -f docker-compose.prod.yml restart backend nginx
```

Check running containers and ports:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Expected logistics ports:

```text
logistics_nginx     0.0.0.0:8000->80/tcp
logistics_backend   8000/tcp
```

---

## Git Notes

Before pulling on the server, make sure local server edits are committed or stashed:

```bash
git status
git stash push -m "server local changes"
git pull
```

Do not commit:

- `.env`
- Local notes such as `log.txt`
- Temporary files
- Docker volumes or build output

---

## Next Planned Work

Container section redesign:

- Improve container archive: group export by client and include all document categories. Print-ready HTML is available, and ZIP export now downloads the uploaded originals grouped by client.
- Connect internal system invoices: if cargo source is company buying service, link PI/CI/PL/SC from the invoice section and use them to fill cargo data.
- Add OCR foundation: extract data from uploaded PI/CI/PL/SC/CO/goods invoices, show a review modal, then fill description, HS code, cartons, weights, CBM, marks, and notes.
- Add server temp export handling: ZIP exports are generated in a temp folder and deleted after download; later add PDF export/cleanup scheduling if needed.
- Connect final cost equations: shipping agent rate + clearance agent rate + origin/destination fees + delivery.
- Refine full-container vs LCL workflows inside container profile.
- Keep container ETD synced from the selected shipping agent carrier vessel date unless manually adjusted later.
