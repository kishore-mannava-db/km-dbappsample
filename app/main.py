"""FastAPI app with lifespan, all routers, and timing middleware."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from services.connection_pool import ConnectionPool
from middleware.timing import TimingMiddleware
from routers.health import router as health_router
from routers.form_aps import router as form_aps_router
from routers.participants import router as participants_router
from routers.users import router as users_router
from routers.sessions import router as sessions_router
from routers.audit_logs import router as audit_logs_router
from routers.evaluation import router as eval_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from config import config
        config.resolve()  # Auto-detect Lakebase credentials (SDK or env vars)
        logger.info(f"Resolved config: host={config.host}, user={config.user}, password_len={len(config.password) if config.password else 0}")
        pool = ConnectionPool.get_instance()
        try:
            pool.initialize()
            logger.info("Lakebase connection pool ready")
        except Exception as e:
            logger.warning(f"Startup pool init failed ({e}), will retry via lazy init on first request")
    except Exception as e:
        logger.error(f"Config resolve failed: {e}", exc_info=True)
    yield
    try:
        ConnectionPool.get_instance().close()
    except Exception:
        pass


app = FastAPI(
    title="Lakebase OLTP Evaluation",
    description="50-item evaluation of Databricks Lakebase for OLTP workloads",
    version="1.0.0",
    lifespan=lifespan,
)

class LazyInitMiddleware(BaseHTTPMiddleware):
    """Lazy-initialize pool from x-forwarded-email on first API request."""
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        pool = ConnectionPool.get_instance()
        if pool._pool is None and request.url.path.startswith("/api/"):
            email = request.headers.get("x-forwarded-email")
            if email:
                try:
                    pool.lazy_init_with_email(email)
                except Exception as e:
                    logger.warning(f"Lazy init failed: {e}")
        return await call_next(request)


app.add_middleware(TimingMiddleware)
app.add_middleware(LazyInitMiddleware)

app.include_router(health_router)
app.include_router(form_aps_router, prefix="/api/form-aps", tags=["Form APs"])
app.include_router(participants_router, prefix="/api/participants", tags=["Participants"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(audit_logs_router, prefix="/api/audit", tags=["Audit"])
app.include_router(eval_router, prefix="/api/eval", tags=["Evaluation"])
