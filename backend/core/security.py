from datetime import datetime, timezone
from uuid import UUID, uuid4
import jwt
from pwdlib import PasswordHash
from backend.core.errors import unauthorized


class Security:
    def __init__(self, settings, key):
        self.settings = settings
        self.key = key
        self.passwords = PasswordHash.recommended()
        self.dummy_hash = self.passwords.hash("dummy-password-not-an-account")

    def encode(self, user_id, session_id, token_type, expires_at):
        now = int(datetime.now(timezone.utc).timestamp())
        return jwt.encode({"sub": user_id, "sid": session_id, "jti": str(uuid4()), "type": token_type,
                           "iat": now, "nbf": now, "exp": expires_at,
                           "iss": self.settings.jwt_issuer, "aud": self.settings.jwt_audience}, self.key, algorithm="HS256")

    def decode(self, token, token_type, verify_exp=True):
        try:
            claims = jwt.decode(token, self.key, algorithms=["HS256"], issuer=self.settings.jwt_issuer,
                                audience=self.settings.jwt_audience,
                                options={"require": ["sub", "sid", "jti", "type", "iat", "nbf", "exp", "iss", "aud"], "verify_exp": verify_exp})
            if claims["type"] != token_type:
                raise ValueError("Wrong token type")
            for name in ["sub", "sid", "jti"]:
                UUID(claims[name])
            return claims
        except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
            raise unauthorized("Сессия недействительна или истекла. Войди снова.")
