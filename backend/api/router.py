from fastapi import APIRouter, Request
from sqlalchemy import text
from backend.api.routes import auth, gallery, learning

router = APIRouter(prefix="/api")
router.include_router(auth.router)
router.include_router(learning.router)
router.include_router(gallery.router)


@router.get("/health", tags=["System"])
def health(request: Request):
    request.app.state.redis.ping()
    with request.app.state.session_factory() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
