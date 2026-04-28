from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import time

from app.config import settings
from app.core.limiter import limiter
from app.api.v1 import auth, users, clients, invoices, shipping_agents, clearance_agents, market, company, branches, reference, bookings, warehouses, suppliers, products, shop, customers, client_portal, accounting, customs_calculator, customs_references

app = FastAPI(
    title="Logistics System API",
    description="Jordan Logistics Company — Branch management system",
    version="1.0.0",
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
    openapi_url="/api/openapi.json" if not settings.is_production else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Trusted hosts (production only — prevents Host header injection)
if settings.is_production:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

# CORS — explicit methods/headers, no wildcard in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    # Remove fingerprinting headers
    if "server" in response.headers:
        del response.headers["server"]
    if "x-powered-by" in response.headers:
        del response.headers["x-powered-by"]
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["X-Process-Time"] = str(round(time.time() - start, 4))
    return response

# Routers
API_PREFIX = "/api/v1"

app.include_router(auth.router,             prefix=f"{API_PREFIX}/auth",             tags=["Auth"])
app.include_router(users.router,            prefix=f"{API_PREFIX}/users",            tags=["Users"])
app.include_router(clients.router,          prefix=f"{API_PREFIX}/clients",          tags=["Clients"])
app.include_router(invoices.router,         prefix=f"{API_PREFIX}/invoices",         tags=["Invoices"])
app.include_router(shipping_agents.router,  prefix=f"{API_PREFIX}/shipping-agents",  tags=["Shipping Agents"])
app.include_router(clearance_agents.router, prefix=f"{API_PREFIX}/clearance-agents", tags=["Clearance Agents"])
app.include_router(market.router,           prefix=f"{API_PREFIX}/market",           tags=["Market Board"])
app.include_router(company.router,          prefix=f"{API_PREFIX}/company",          tags=["Company"])
app.include_router(branches.router,         prefix=f"{API_PREFIX}/branches",         tags=["Branches"])
app.include_router(reference.router,        prefix=f"{API_PREFIX}/reference",        tags=["Reference"])
app.include_router(bookings.router,         prefix=f"{API_PREFIX}/bookings",         tags=["Bookings"])
app.include_router(warehouses.router,       prefix=f"{API_PREFIX}/warehouses",       tags=["Warehouses"])
app.include_router(suppliers.router,        prefix=f"{API_PREFIX}/suppliers",        tags=["Suppliers"])
app.include_router(products.router,         prefix=f"{API_PREFIX}/products",         tags=["Products"])
app.include_router(shop.router,             prefix=f"{API_PREFIX}/shop",             tags=["Shop"])
app.include_router(customers.router,        prefix=f"{API_PREFIX}/customers",        tags=["Customers"])
app.include_router(client_portal.router,   prefix=f"{API_PREFIX}/client-portal",    tags=["Client Portal"])
app.include_router(accounting.router,      prefix=f"{API_PREFIX}/accounting",       tags=["Accounting"])
app.include_router(customs_calculator.router, prefix=f"{API_PREFIX}/customs-calculator", tags=["Customs Calculator"])
app.include_router(customs_references.router, prefix=f"{API_PREFIX}/customs-references", tags=["Customs References"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "env": settings.APP_ENV}

# Serve uploaded product photos
os.makedirs("uploads/products", exist_ok=True)
os.makedirs("uploads/bookings", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
