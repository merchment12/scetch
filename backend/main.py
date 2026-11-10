"""Application composition. Run: .venv/bin/python -m uvicorn backend.main:app --reload."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from redis import Redis
from redis.exceptions import RedisError

from backend.api.router import router
from backend.core.config import ROOT, Settings
from backend.core.database import Base, make_database
from backend.core.errors import AppError
from backend.core.security import Security
from backend.models import User  # Registers ORM models for additive schema initialization.
from backend.repositories.learning import LessonRepository


def create_app(storage: Path | None = None, *, settings: Settings | None = None, redis_client=None) -> FastAPI:
    config = settings or Settings()
    if storage is not None:
        config = config.model_copy(update={"storage_dir": Path(storage)})

    @asynccontextmanager
    async def lifespan(app):
        (config.storage_dir / "uploads").mkdir(parents=True, exist_ok=True)
        engine, factory = make_database(config.storage_dir)
        client = redis_client if redis_client is not None else Redis.from_url(config.redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
        try:
            client.ping()
            Base.metadata.create_all(engine)
            app.state.settings = config
            app.state.session_factory = factory
            app.state.redis = client
            app.state.security = Security(config, config.signing_key())
            app.state.lessons = LessonRepository()
            yield
        finally:
            engine.dispose()
            if redis_client is None:
                client.close()

    app = FastAPI(title="Техно / скетчинг API", version="0.2.0", lifespan=lifespan)

    @app.exception_handler(AppError)
    async def app_error(request: Request, error: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if error.status == 401 else {}
        if request.url.path.startswith("/api/auth"):
            headers["Cache-Control"] = "no-store"
        response = JSONResponse({"detail": error.detail}, status_code=error.status, headers=headers)
        if error.status == 401 and request.url.path == "/api/auth/refresh":
            response.delete_cookie("techno_refresh", path="/api/auth", secure=config.cookie_secure, httponly=True, samesite="strict")
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # Pydantic normally echoes input values, including passwords, in validation errors.
        detail = [{"loc": item["loc"], "msg": item["msg"], "type": item["type"]} for item in error.errors()]
        return JSONResponse({"detail": detail}, status_code=422, headers={"Cache-Control": "no-store"})

    @app.exception_handler(RedisError)
    async def redis_error(request: Request, error: RedisError):
        return JSONResponse({"detail": "Сервис сессий недоступен. Попробуй ещё раз чуть позже."}, status_code=503, headers={"Cache-Control": "no-store"})

    @app.middleware("http")
    async def private_cache(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/lessons"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(router)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def api_not_found(path: str):
        raise AppError(404, "API-маршрут не найден.")

    if (ROOT / "dist").exists():
        app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="frontend")
    return app


app = create_app()
