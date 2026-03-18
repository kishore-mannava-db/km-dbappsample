"""Health and info endpoints."""
from fastapi import APIRouter, Request
from services.connection_pool import ConnectionPool

router = APIRouter()


@router.get("/health")
async def health():
    pool = ConnectionPool.get_instance()
    stats = pool.get_pool_stats()
    return {"status": "healthy", "service": "lakebase-oltp-eval", "pool": stats}


@router.get("/debug/headers")
async def debug_headers(request: Request):
    """Debug: show request headers to verify proxy token forwarding."""
    headers = dict(request.headers)
    # Mask tokens for safety
    for k in headers:
        if 'token' in k.lower() or 'auth' in k.lower():
            v = headers[k]
            headers[k] = v[:20] + "..." if len(v) > 20 else v
    return {"headers": headers}


@router.get("/debug/init")
async def debug_init(request: Request):
    """Debug: try to initialize pool using app's SP identity."""
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        me = w.current_user.me()
        user_info = f"{me.user_name} (display: {me.display_name})"
    except Exception as e:
        return {"error": f"WorkspaceClient failed: {e}"}

    try:
        instance = w.database.get_database_instance(name="lakebase-autoscale-eval")
        inst_info = f"{instance.name} ({instance.state})"
    except Exception as e:
        return {"error": f"get_database_instance failed: {e}", "user": user_info}

    try:
        cred = w.database.generate_database_credential(
            request_id="debug-init",
            instance_names=["lakebase-autoscale-eval"],
        )
        token_len = len(cred.token)
    except Exception as e:
        return {"error": f"generate_database_credential failed: {e}", "user": user_info, "instance": inst_info}

    # Token identity must match PG user — use SP's own UUID as PG user
    pg_user = me.user_name  # This is the SP UUID

    pool = ConnectionPool.get_instance()
    try:
        from config import config
        config.host = instance.read_write_dns
        config.user = pg_user
        config.password = cred.token
        config.dev_user_email = pg_user
        pool.initialize()
        return {"status": "initialized", "user": user_info, "pg_user": pg_user, "instance": inst_info, "token_len": token_len, "pool": pool.get_pool_stats()}
    except Exception as e:
        return {"error": f"Pool init failed: {e}", "user": user_info, "pg_user": pg_user, "instance": inst_info, "token_len": token_len}


@router.get("/api/info")
async def info():
    return {
        "service": "Lakebase OLTP Evaluation Track",
        "version": "1.0.0",
        "endpoints": {
            "crud": ["/api/form-aps", "/api/participants", "/api/users", "/api/sessions", "/api/audit"],
            "evaluation": ["/api/eval/read-performance", "/api/eval/write-performance",
                          "/api/eval/rls-check", "/api/eval/index-check", "/api/eval/integrity-check",
                          "/api/eval/pool-stats", "/api/eval/concurrency-test", "/api/eval/full-report"],
        },
    }
