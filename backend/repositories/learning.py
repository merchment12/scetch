import json
from sqlalchemy import select
from backend.core.config import ROOT
from backend.core.errors import AppError
from backend.models import Progress


class LessonRepository:
    def __init__(self):
        self.lessons = json.loads((ROOT / "backend/data/lessons.json").read_text(encoding="utf-8"))
        self.examples = json.loads((ROOT / "backend/data/examples.json").read_text(encoding="utf-8"))

    def get(self, lesson_id):
        lesson = next((item for item in self.lessons if item["id"] == lesson_id), None)
        if not lesson:
            raise AppError(404, "Урок не найден.")
        return lesson


class ProgressRepository:
    def __init__(self, db):
        self.db = db

    def list(self, user_id):
        return self.db.scalars(select(Progress).where(Progress.user_id == user_id)).all()

    def save(self, user_id, lesson_id, **values):
        row = self.db.get(Progress, (user_id, lesson_id))
        if row is None:
            row = Progress(user_id=user_id, lesson_id=lesson_id, **values)
            self.db.add(row)
        else:
            for key, value in values.items():
                setattr(row, key, value)
        return row
