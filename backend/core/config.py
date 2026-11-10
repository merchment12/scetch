from pathlib import Path
import os
import secrets

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SKETCH_", env_file=ROOT / ".env", extra="ignore", populate_by_name=True)
    storage_dir: Path = Field(default=ROOT / "backend/storage", validation_alias="SKETCH_STORAGE")
    redis_url: str = "redis://127.0.0.1:6380/0"
    redis_prefix: str = "techno:"
    jwt_secret: SecretStr | None = None
    jwt_issuer: str = "techno-sketching"
    jwt_audience: str = "techno-web"
    access_ttl_seconds: int = Field(default=900, ge=1, le=3600)
    refresh_ttl_seconds: int = Field(default=2592000, ge=60, le=7776000)
    cookie_secure: bool = False
    environment: str = "development"
    trusted_origins: list[str] = ["http://127.0.0.1:8000", "http://localhost:8000", "http://127.0.0.1:5173", "http://localhost:5173"]
    auth_rate_limit: int = Field(default=20, ge=1)
    max_upload_bytes: int = 10 * 1024 * 1024
    max_image_pixels: int = 20_000_000

    def signing_key(self) -> str:
        if self.environment == "production" and (not self.jwt_secret or not self.cookie_secure):
            raise RuntimeError("В production задай SKETCH_JWT_SECRET и SKETCH_COOKIE_SECURE=true.")
        if self.jwt_secret:
            value = self.jwt_secret.get_secret_value()
            if len(value.encode()) < 32:
                raise RuntimeError("SKETCH_JWT_SECRET должен содержать минимум 32 байта.")
            return value
        # Local-only secret persists across restarts, never appears in logs or Git.
        path = self.storage_dir / "jwt.key"
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            value = path.read_text().strip()
            if len(value.encode()) < 32:
                raise RuntimeError("Локальный ключ JWT повреждён или слишком короткий.")
            return value
        with os.fdopen(descriptor, "w") as file:
            value = secrets.token_urlsafe(48)
            file.write(value)
        return value
