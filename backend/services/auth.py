from datetime import datetime, timezone
import time
from uuid import uuid4
from sqlalchemy.exc import IntegrityError
from backend.core.errors import AppError, unauthorized
from backend.models import User
from backend.repositories.users import UserRepository
from backend.schemas.auth import TokenResponse, UserRead


class AuthService:
    def __init__(self, db, security, sessions, settings):
        self.db = db
        self.users = UserRepository(db)
        self.security = security
        self.sessions = sessions
        self.settings = settings

    def register(self, data):
        if self.users.by_email(data.email):
            raise AppError(409, "Этот email уже зарегистрирован. Войди в аккаунт.")
        user = User(id=str(uuid4()), email=data.email, display_name=data.display_name,
                    password_hash=self.security.passwords.hash(data.password), created_at=datetime.now(timezone.utc).isoformat())
        imported = False
        try:
            self.users.add(user)
            if data.legacy_profile_id:
                imported = self.users.claim_guest(str(data.legacy_profile_id), user.id)
            result = self.issue(user, imported=imported)
            self.db.commit()
            return result
        except IntegrityError:
            self.db.rollback()
            raise AppError(409, "Этот email или профиль уже зарегистрирован.")
        except Exception:
            self.db.rollback()
            raise

    def login(self, data):
        user = self.users.by_email(data.email)
        digest = user.password_hash if user else self.security.dummy_hash
        valid = self.security.passwords.verify(data.password, digest)
        if not user or not valid:
            raise unauthorized("Неверный email или пароль.")
        return self.issue(user)

    def issue(self, user, session_id=None, expires_at=None, old_refresh=None, imported=False):
        now = int(time.time())
        session_id = session_id or str(uuid4())
        expires_at = expires_at or now + self.settings.refresh_ttl_seconds
        refresh = self.security.encode(user.id, session_id, "refresh", expires_at)
        access = self.security.encode(user.id, session_id, "access", min(now + self.settings.access_ttl_seconds, expires_at))
        if old_refresh:
            self.sessions.rotate(session_id, user.id, old_refresh, refresh)
        else:
            self.sessions.create(session_id, user.id, refresh, expires_at)
        response = TokenResponse(access_token=access, expires_in=min(self.settings.access_ttl_seconds, expires_at - now),
                                 user=UserRead.model_validate(user), guest_imported=imported)
        return response, refresh, expires_at

    def refresh(self, token):
        claims = self.security.decode(token or "", "refresh")
        user = self.users.get(claims["sub"])
        if not user:
            raise unauthorized()
        return self.issue(user, session_id=claims["sid"], expires_at=claims["exp"], old_refresh=token)

    def current_user(self, token):
        claims = self.security.decode(token, "access")
        if not self.sessions.active(claims["sid"], claims["sub"]):
            raise unauthorized("Сессия отозвана. Войди снова.")
        user = self.users.get(claims["sub"])
        if user is None:
            raise unauthorized()
        return user

    def logout(self, token):
        if not token:
            return
        try:
            claims = self.security.decode(token, "refresh", verify_exp=False)
        except AppError:
            return
        self.sessions.revoke(claims["sid"])
