from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.core.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(60))
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String)


class Progress(Base):
    __tablename__ = "progress"
    # Retain the existing column name so upgrading does not delete guest data.
    user_id: Mapped[str] = mapped_column("learner", String(36), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String, primary_key=True)
    seen_steps: Mapped[list] = mapped_column(JSON)
    checks: Mapped[list] = mapped_column(JSON)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[str] = mapped_column(String)


class Artwork(Base):
    __tablename__ = "artworks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column("learner", String(36), index=True)
    lesson_id: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class Favorite(Base):
    __tablename__ = "favorites"
    user_id: Mapped[str] = mapped_column("learner", String(36), primary_key=True)
    artwork_id: Mapped[str] = mapped_column(String, primary_key=True)


class LegacyClaim(Base):
    __tablename__ = "legacy_claims"
    legacy_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
