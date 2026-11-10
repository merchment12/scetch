import time
from fastapi import APIRouter, Depends, Request, Response
from backend.api.dependencies import auth_limit, auth_service, cookie_request, current_user, trusted_origin
from backend.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["Authentication"])
REFRESH_COOKIE = "techno_refresh"


def token_response(result, response, settings):
    body, refresh, expires = result
    response.set_cookie(REFRESH_COOKIE, refresh, max_age=max(0, expires - int(time.time())),
                        httponly=True, secure=settings.cookie_secure, samesite="strict", path="/api/auth")
    response.headers["Cache-Control"] = "no-store"
    return body


@router.post("/register", status_code=201, response_model=TokenResponse, dependencies=[Depends(trusted_origin), Depends(auth_limit)])
def register(data: RegisterRequest, response: Response, request: Request, service=Depends(auth_service)):
    return token_response(service.register(data), response, request.app.state.settings)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(trusted_origin), Depends(auth_limit)])
def login(data: LoginRequest, response: Response, request: Request, service=Depends(auth_service)):
    return token_response(service.login(data), response, request.app.state.settings)


@router.post("/refresh", response_model=TokenResponse, dependencies=[Depends(cookie_request)])
def refresh(request: Request, response: Response, service=Depends(auth_service)):
    return token_response(service.refresh(request.cookies.get(REFRESH_COOKIE)), response, request.app.state.settings)


@router.post("/logout", status_code=204, dependencies=[Depends(cookie_request)])
def logout(request: Request, response: Response, service=Depends(auth_service)):
    service.logout(request.cookies.get(REFRESH_COOKIE))
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth", secure=request.app.state.settings.cookie_secure, httponly=True, samesite="strict")
    response.headers["Cache-Control"] = "no-store"


@router.get("/me", response_model=UserRead)
def me(response: Response, user=Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return user
