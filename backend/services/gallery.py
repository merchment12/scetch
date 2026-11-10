from datetime import datetime, timezone
import secrets
from uuid import uuid4
from backend.core.errors import AppError
from backend.models import Artwork
from backend.repositories.artworks import ArtworkRepository
from backend.services.images import prepare_image


def artwork_dict(row, favorites=()):
    return {"id": row.id, "title": row.title, "lesson_id": row.lesson_id, "image_url": f"/api/artworks/{row.id}/image",
            "description": row.description, "author": "Твоя работа", "kind": "mine", "created_at": row.created_at, "favorite": row.id in favorites}


class GalleryService:
    def __init__(self, db, lessons, settings):
        self.db = db
        self.repository = ArtworkRepository(db)
        self.lessons = lessons
        self.settings = settings
        self.uploads = settings.storage_dir / "uploads"

    def list(self, user_id):
        favorites = self.repository.favorite_ids(user_id)
        return [artwork_dict(row, favorites) for row in self.repository.list(user_id)] + [{**item, "favorite": item["id"] in favorites} for item in self.lessons.examples]

    def owned(self, artwork_id, user_id):
        row = self.repository.owned(artwork_id, user_id)
        if row is None:
            raise AppError(404, "Работа не найдена.")
        return row

    def upload(self, user_id, file, title, lesson_id, description):
        self.lessons.get(lesson_id)
        if not title.strip():
            raise AppError(422, "Добавь название работы.")
        content = prepare_image(file, self.settings)
        filename = secrets.token_hex(20) + ".jpg"
        path = self.uploads / filename
        path.write_bytes(content)
        row = Artwork(id=str(uuid4()), user_id=user_id, lesson_id=lesson_id, title=title.strip(),
                      description=description.strip(), filename=filename, created_at=datetime.now(timezone.utc).isoformat())
        try:
            self.repository.add(row)
            self.db.commit()
        except Exception:
            self.db.rollback()
            path.unlink(missing_ok=True)
            raise
        return artwork_dict(row)

    def favorite(self, user_id, artwork_id):
        if artwork_id not in {item["id"] for item in self.lessons.examples}:
            self.owned(artwork_id, user_id)
        result = self.repository.toggle_favorite(user_id, artwork_id)
        self.db.commit()
        return {"favorite": result}

    def delete(self, user_id, artwork_id):
        row = self.owned(artwork_id, user_id)
        path = self.uploads / row.filename
        self.repository.delete(row)
        self.db.commit()
        path.unlink(missing_ok=True)
