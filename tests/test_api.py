from io import BytesIO
from uuid import uuid4

from fastapi.testclient import TestClient
from PIL import Image
import pytest

from backend.main import create_app
from conftest import register


@pytest.fixture
def client(settings, redis_client):
    with TestClient(create_app(settings=settings, redis_client=redis_client)) as session:
        register(session)
        yield session


def image_bytes(format="PNG", size=(40, 30), mode="RGB"):
    stream = BytesIO()
    Image.new(mode, size, "white").save(stream, format)
    return stream.getvalue()


def upload(client, **extra):
    return client.post("/api/artworks", data={"title": "Первый профиль", "lesson_id": "car", "description": "Хочу улучшить пропорции", **extra}, files={"file": ("sketch.png", image_bytes(), "image/png")})


def test_curriculum_has_nine_complete_lessons(client):
    lessons = client.get("/api/lessons").json()
    assert [l["id"] for l in lessons] == ["line", "planes", "ellipses", "perspective", "cylinders", "light", "form", "proportions", "car"]
    assert [l["number"] for l in lessons] == list(range(1, 10))
    assert all(l["repetitions"] for l in lessons)
    assert all(len(l["steps"]) == 4 and len(l["checks"]) == 3 for l in lessons)
    assert client.get("/api/lessons/missing").status_code == 404


def test_progress_persists_across_clients_and_server_restart(settings, redis_client):
    with TestClient(create_app(settings=settings, redis_client=redis_client)) as first:
        data = register(first)
        result = first.put("/api/progress/line", json={"seen_steps": [0, 1, 2, 3], "checks": [True] * 3, "completed": True})
        assert result.status_code == 200
    with TestClient(create_app(settings=settings, redis_client=redis_client)) as restarted:
        response = restarted.get("/api/profile", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert response.json()["percent"] == 20
        assert response.json()["progress"]["line"]["completed"] is True


@pytest.mark.parametrize("payload", [
    {"seen_steps": [0], "checks": [True] * 3, "completed": True},
    {"seen_steps": [0, 1, 2, 3], "checks": [True, False, True], "completed": True},
    {"seen_steps": [-1], "checks": [False] * 3},
    {"seen_steps": [4], "checks": [False] * 3},
    {"seen_steps": [0], "checks": []},
])
def test_invalid_completion_rejected(client, payload):
    assert client.put("/api/progress/line", json=payload).status_code == 422
    assert client.get("/api/profile").json()["percent"] == 0


def test_account_profiles_are_isolated(client):
    first = client.headers['Authorization']
    client.put("/api/progress/line", json={"seen_steps": [0], "checks": [False] * 3})
    register(client, 'other@example.com')
    assert client.get("/api/profile").json()["progress"] == {}
    assert client.get("/api/profile", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.get("/api/profile", headers={"Authorization": "", "X-Learner-ID": str(uuid4())}).status_code == 401
    client.headers['Authorization'] = first


def test_upload_gallery_favorite_and_delete(client):
    created = upload(client)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["kind"] == "mine" and item["lesson_id"] == "car"
    image = client.get(item["image_url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/jpeg"
    assert Image.open(BytesIO(image.content)).size == (40, 30)
    assert client.get("/api/profile").json()["artworks_count"] == 1
    assert client.post(f"/api/gallery/{item['id']}/favorite").json()["favorite"] is True
    gallery = client.get("/api/gallery").json()
    assert len(gallery) == 5
    assert gallery[0]["favorite"] is True
    assert client.delete(f"/api/artworks/{item['id']}").status_code == 204
    assert client.get(item["image_url"]).status_code == 404
    assert len(client.get("/api/gallery").json()) == 4


def test_private_artworks_inaccessible_from_other_profile(client):
    item = upload(client).json()
    first = client.headers['Authorization']
    other_data = register(client, 'other@example.com')
    other = {'Authorization': f"Bearer {other_data['access_token']}"}
    client.headers['Authorization'] = first
    assert client.get(item["image_url"], headers=other).status_code == 404
    assert client.delete(f"/api/artworks/{item['id']}", headers=other).status_code == 404
    assert client.post(f"/api/gallery/{item['id']}/favorite", headers=other).status_code == 404
    assert all(i["id"] != item["id"] for i in client.get("/api/gallery", headers=other).json())


def test_demo_favorites_persist_and_toggle(client):
    assert client.post("/api/gallery/demo-coupe/favorite").json()["favorite"] is True
    assert next(i for i in client.get("/api/gallery").json() if i["id"] == "demo-coupe")["favorite"]
    assert client.post("/api/gallery/demo-coupe/favorite").json()["favorite"] is False
    assert client.post("/api/gallery/missing/favorite").status_code == 404


@pytest.mark.parametrize("file,content_type", [(b"<script>alert(1)</script>", "image/png"), (image_bytes("GIF"), "image/gif"), (b"broken", "image/jpeg")])
def test_invalid_upload_rejected(client, file, content_type):
    response = client.post("/api/artworks", data={"title": "Work", "lesson_id": "line"}, files={"file": ("test.png", file, content_type)})
    assert response.status_code == 415
    assert client.get("/api/profile").json()["artworks_count"] == 0


def test_size_limit_and_unknown_lesson(client):
    large = client.post("/api/artworks", data={"title": "Work", "lesson_id": "line"}, files={"file": ("large.png", b"x" * (10 * 1024 * 1024 + 1), "image/png")})
    assert large.status_code == 413
    assert upload(client, lesson_id="missing").status_code == 404
    assert upload(client, title="   ").status_code == 422


def test_html_text_is_preserved_as_plain_data(client):
    title = '<img src=x onerror="alert(1)">'
    assert upload(client, title=title).json()["title"] == title
    # React renders these values as text; the API never creates executable HTML.
    assert client.get("/api/gallery").json()[0]["title"] == title


def test_unknown_api_route_never_returns_spa(client):
    response = client.get("/api/missing")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
