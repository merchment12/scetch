from typing import Annotated
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from backend.api.dependencies import current_user, gallery_service

router = APIRouter(tags=["Gallery"])


@router.get("/gallery")
def gallery(user=Depends(current_user), service=Depends(gallery_service)):
    return service.list(user.id)


@router.post("/artworks", status_code=201)
def upload_artwork(file: Annotated[UploadFile, File()], title: Annotated[str, Form(min_length=1, max_length=100)],
                   lesson_id: Annotated[str, Form()], description: Annotated[str, Form(max_length=1000)] = "",
                   user=Depends(current_user), service=Depends(gallery_service)):
    return service.upload(user.id, file.file, title, lesson_id, description)


@router.get("/artworks/{artwork_id}/image")
def artwork_image(artwork_id: str, user=Depends(current_user), service=Depends(gallery_service)):
    row = service.owned(artwork_id, user.id)
    # Do not serve a cached private image after logout or account switching.
    return FileResponse(service.uploads / row.filename, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})


@router.post("/gallery/{artwork_id}/favorite")
def favorite(artwork_id: str, user=Depends(current_user), service=Depends(gallery_service)):
    return service.favorite(user.id, artwork_id)


@router.delete("/artworks/{artwork_id}", status_code=204)
def delete_artwork(artwork_id: str, user=Depends(current_user), service=Depends(gallery_service)):
    service.delete(user.id, artwork_id)
