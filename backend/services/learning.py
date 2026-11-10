from datetime import datetime, timezone
from backend.core.errors import AppError
from backend.repositories.artworks import ArtworkRepository
from backend.repositories.learning import ProgressRepository


def progress_dict(row):
    return {"seen_steps": row.seen_steps, "checks": row.checks, "completed": row.completed, "updated_at": row.updated_at}


class LearningService:
    def __init__(self, db, lessons):
        self.db = db
        self.lessons = lessons
        self.progress = ProgressRepository(db)
        self.artworks = ArtworkRepository(db)

    def profile(self, user_id):
        progress = {row.lesson_id: progress_dict(row) for row in self.progress.list(user_id)}
        completed = sum(p["completed"] for p in progress.values())
        return {"progress": progress, "completed_lessons": completed, "total_lessons": len(self.lessons.lessons),
                "percent": round(completed / len(self.lessons.lessons) * 100), "artworks_count": self.artworks.count(user_id)}

    def save(self, user_id, lesson_id, update):
        lesson = self.lessons.get(lesson_id)
        if any(i < 0 or i >= len(lesson["steps"]) for i in update.seen_steps):
            raise AppError(422, "Такого шага нет в уроке.")
        if len(update.checks) != len(lesson["checks"]):
            raise AppError(422, "Передай все пункты самопроверки.")
        seen = sorted(set(update.seen_steps))
        if update.completed and (len(seen) != len(lesson["steps"]) or not all(update.checks)):
            raise AppError(422, "Сначала изучи все шаги и отметь пункты самопроверки.")
        row = self.progress.save(user_id, lesson_id, seen_steps=seen, checks=update.checks,
                                 completed=update.completed, updated_at=datetime.now(timezone.utc).isoformat())
        self.db.commit()
        return progress_dict(row)
