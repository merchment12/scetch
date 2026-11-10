from fastapi import APIRouter, Depends, Request
from backend.api.dependencies import current_user, learning_service
from backend.schemas.learning import ProgressUpdate

router = APIRouter(tags=["Learning"])


@router.get("/lessons")
def lessons(request: Request):
    return request.app.state.lessons.lessons


@router.get("/lessons/{lesson_id}")
def lesson(lesson_id: str, request: Request):
    return request.app.state.lessons.get(lesson_id)


@router.get("/profile")
def profile(user=Depends(current_user), service=Depends(learning_service)):
    return service.profile(user.id)


@router.put("/progress/{lesson_id}")
def save_progress(lesson_id: str, update: ProgressUpdate, user=Depends(current_user), service=Depends(learning_service)):
    return service.save(user.id, lesson_id, update)
