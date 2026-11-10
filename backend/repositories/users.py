from sqlalchemy import select, update
from backend.models import Artwork, Favorite, LegacyClaim, Progress, User
from backend.core.errors import AppError


class UserRepository:
    def __init__(self, db):
        self.db = db

    def get(self, user_id):
        return self.db.get(User, user_id)

    def by_email(self, email):
        return self.db.scalar(select(User).where(User.email == email))

    def add(self, user):
        self.db.add(user)
        self.db.flush()

    def claim_guest(self, legacy_id, user_id):
        if self.get(legacy_id) or self.db.get(LegacyClaim, legacy_id):
            raise AppError(409, "Этот профиль уже привязан к аккаунту. Убери перенос данных и попробуй снова.")
        imported = False
        for model in [Progress, Artwork, Favorite]:
            result = self.db.execute(update(model).where(model.user_id == legacy_id).values(user_id=user_id))
            imported = imported or result.rowcount > 0
        self.db.add(LegacyClaim(legacy_id=legacy_id, user_id=user_id))
        self.db.flush()
        return imported
