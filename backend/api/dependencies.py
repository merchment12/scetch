from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.core.errors import AppError, unauthorized
from backend.repositories.sessions import SessionRepository
from backend.services.auth import AuthService
from backend.services.gallery import GalleryService
from backend.services.learning import LearningService

bearer = HTTPBearer(auto_error=False, scheme_name="AccessJWT", description="Access JWT: Authorization: Bearer <token>")


def database(request: Request):
    with request.app.state.session_factory() as db:
        yield db


def auth_service(request: Request, db=Depends(database)):
    state = request.app.state
    return AuthService(db, state.security, SessionRepository(state.redis, state.settings.redis_prefix), state.settings)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), service=Depends(auth_service)):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    return service.current_user(credentials.credentials)


def learning_service(request: Request, db=Depends(database)):
    return LearningService(db, request.app.state.lessons)


def gallery_service(request: Request, db=Depends(database)):
    return GalleryService(db, request.app.state.lessons, request.app.state.settings)


def trusted_origin(request: Request):
    origin = request.headers.get("origin")
    if (origin and origin.rstrip("/") not in request.app.state.settings.trusted_origins) or request.headers.get("sec-fetch-site") == "cross-site":
        raise AppError(403, "Запрос с этого сайта запрещён.")


def cookie_request(request: Request):
    trusted_origin(request)
    if request.headers.get("x-requested-with") != "techno-web":
        raise AppError(403, "Для этого запроса нужен заголовок X-Requested-With: techno-web.")


def auth_limit(request: Request, service=Depends(auth_service)):
    # IP is taken from the connection, not an untrusted forwarded header.
    host = request.client.host if request.client else "unknown"
    service.sessions.rate_limit(host, request.app.state.settings.auth_rate_limit)
