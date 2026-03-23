from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.api.v1 import auth, users, clients, invoices, containers, shipping_agents, clearance_agents, market, company

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Logistics System API",
    description="Jordan Logistics Company — Branch management system",
    version="1.0.0",
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
API_PREFIX = "/api/v1"

app.include_router(auth.router,             prefix=f"{API_PREFIX}/auth",             tags=["Auth"])
app.include_router(users.router,            prefix=f"{API_PREFIX}/users",            tags=["Users"])
app.include_router(clients.router,          prefix=f"{API_PREFIX}/clients",          tags=["Clients"])
app.include_router(invoices.router,         prefix=f"{API_PREFIX}/invoices",         tags=["Invoices"])
app.include_router(containers.router,       prefix=f"{API_PREFIX}/containers",       tags=["Containers"])
app.include_router(shipping_agents.router,  prefix=f"{API_PREFIX}/shipping-agents",  tags=["Shipping Agents"])
app.include_router(clearance_agents.router, prefix=f"{API_PREFIX}/clearance-agents", tags=["Clearance Agents"])
app.include_router(market.router,           prefix=f"{API_PREFIX}/market",           tags=["Market Board"])
app.include_router(company.router,          prefix=f"{API_PREFIX}/company",          tags=["Company"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "env": settings.APP_ENV}
