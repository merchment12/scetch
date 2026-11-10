from sqlalchemy import delete, func, select
from backend.models import Artwork, Favorite


class ArtworkRepository:
    def __init__(self, db):
        self.db = db

    def list(self, user_id):
        return self.db.scalars(select(Artwork).where(Artwork.user_id == user_id).order_by(Artwork.created_at.desc())).all()

    def owned(self, artwork_id, user_id):
        return self.db.scalar(select(Artwork).where(Artwork.id == artwork_id, Artwork.user_id == user_id))

    def count(self, user_id):
        return self.db.scalar(select(func.count()).select_from(Artwork).where(Artwork.user_id == user_id))

    def add(self, artwork):
        self.db.add(artwork)

    def delete(self, artwork):
        self.db.execute(delete(Favorite).where(Favorite.artwork_id == artwork.id))
        self.db.delete(artwork)

    def favorite_ids(self, user_id):
        return set(self.db.scalars(select(Favorite.artwork_id).where(Favorite.user_id == user_id)))

    def toggle_favorite(self, user_id, artwork_id):
        existing = self.db.get(Favorite, (user_id, artwork_id))
        if existing:
            self.db.delete(existing)
        else:
            self.db.add(Favorite(user_id=user_id, artwork_id=artwork_id))
        return not bool(existing)
