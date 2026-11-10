import hashlib
import sqlite3
import time
from uuid import uuid4
import jwt
import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError
from sqlalchemy import select
from backend.main import create_app
from backend.models import User
from conftest import register

COOKIE_HEADER = {'X-Requested-With': 'techno-web'}


@pytest.fixture
def client(settings, redis_client):
    with TestClient(create_app(settings=settings, redis_client=redis_client)) as session:
        yield session


def test_registration_hashes_password_and_stores_only_refresh_digest_in_redis(client, redis_client, settings):
    response = register(client, email='DESIGNER@Example.com')
    access = response['access_token']
    assert response['token_type'] == 'bearer'
    assert response['user']['email'] == 'designer@example.com'
    assert 'password' not in str(response['user'])
    refresh = client.cookies.get('techno_refresh')
    access_claims = jwt.decode(access, options={'verify_signature': False})
    refresh_claims = jwt.decode(refresh, options={'verify_signature': False})
    assert access_claims['type'] == 'access' and refresh_claims['type'] == 'refresh'
    assert access_claims['sid'] == refresh_claims['sid']
    key = f"{settings.redis_prefix}refresh:{access_claims['sid']}"
    stored = redis_client.hgetall(key)
    assert stored['digest'] == hashlib.sha256(refresh.encode()).hexdigest()
    assert refresh not in str(stored) and access not in str(stored)
    assert 0 < redis_client.ttl(key) <= settings.refresh_ttl_seconds
    with client.app.state.session_factory() as db:
        row = db.scalar(select(User))
        assert row.password_hash.startswith('$argon2id$')
        assert row.password_hash != 'draw-some-lines-2026'
    assert client.get('/api/auth/me').json()['id'] == response['user']['id']


def test_cookie_is_http_only_scoped_and_auth_responses_are_not_cached(client):
    response = client.post('/api/auth/register', json={'email': 'cookie@example.com', 'password': 'valid-password', 'display_name': 'Рисующий'})
    cookie = response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'SameSite=strict' in cookie and 'Path=/api/auth' in cookie
    assert response.headers['cache-control'] == 'no-store'
    assert 'refresh_token' not in response.json()


def test_login_duplicate_email_and_bad_credentials(client):
    original = register(client)
    assert client.post('/api/auth/register', json={'email': 'DESIGNER@example.com', 'password': 'valid-password', 'display_name': 'Другое имя'}).status_code == 409
    bad_password = client.post('/api/auth/login', json={'email': 'designer@example.com', 'password': 'wrong'})
    unknown = client.post('/api/auth/login', json={'email': 'missing@example.com', 'password': 'wrong'})
    assert bad_password.status_code == unknown.status_code == 401
    assert bad_password.json() == unknown.json()
    login = client.post('/api/auth/login', json={'email': 'DESIGNER@example.com', 'password': 'draw-some-lines-2026'})
    assert login.status_code == 200
    assert login.json()['user']['id'] == original['user']['id']
    assert login.json()['access_token'] != original['access_token']


def test_refresh_rotates_and_replay_revokes_the_whole_session(client):
    register(client)
    old_refresh = client.cookies.get('techno_refresh')
    rotated = client.post('/api/auth/refresh', headers=COOKIE_HEADER)
    assert rotated.status_code == 200
    new_refresh = client.cookies.get('techno_refresh')
    assert old_refresh != new_refresh
    access = rotated.json()['access_token']
    assert client.get('/api/profile', headers={'Authorization': f'Bearer {access}'}).status_code == 200
    replay = client.post('/api/auth/refresh', headers={**COOKIE_HEADER, 'Cookie': f'techno_refresh={old_refresh}'})
    assert replay.status_code == 401
    assert client.get('/api/profile', headers={'Authorization': f'Bearer {access}'}).status_code == 401
    assert client.post('/api/auth/refresh', headers={**COOKIE_HEADER, 'Cookie': f'techno_refresh={new_refresh}'}).status_code == 401


def test_logout_revokes_access_and_refresh_immediately(client):
    response = register(client)
    refresh = client.cookies.get('techno_refresh')
    assert client.post('/api/auth/logout', headers=COOKIE_HEADER).status_code == 204
    assert client.get('/api/profile', headers={'Authorization': f"Bearer {response['access_token']}"}).status_code == 401
    assert client.post('/api/auth/refresh', headers={**COOKIE_HEADER, 'Cookie': f'techno_refresh={refresh}'}).status_code == 401
    assert client.cookies.get('techno_refresh') is None


def test_expired_forged_and_wrong_type_tokens_are_rejected(client):
    result = register(client)
    claims = jwt.decode(result['access_token'], options={'verify_signature': False})
    key = client.app.state.security.key
    invalid = [
        jwt.encode({**claims, 'exp': int(time.time()) - 60}, key, algorithm='HS256'),
        jwt.encode(claims, 'a-completely-different-signing-key-0000', algorithm='HS256'),
        jwt.encode(claims, key + 'longer-key', algorithm='HS384'),
        jwt.encode({k: v for k, v in claims.items() if k != 'exp'}, key, algorithm='HS256'),
        client.cookies.get('techno_refresh'),
    ]
    for token in invalid:
        response = client.get('/api/profile', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 401
        assert response.headers['www-authenticate'] == 'Bearer'
    assert client.get('/api/profile', headers={'Authorization': '', 'X-Learner-ID': result['user']['id']}).status_code == 401


def test_csrf_checks_require_trusted_origin_and_custom_header(client):
    register(client)
    assert client.post('/api/auth/refresh').status_code == 403
    assert client.post('/api/auth/refresh', headers={**COOKIE_HEADER, 'Origin': 'https://untrusted.example'}).status_code == 403
    assert client.post('/api/auth/logout', headers={**COOKIE_HEADER, 'Sec-Fetch-Site': 'cross-site'}).status_code == 403
    assert client.post('/api/auth/refresh', headers={**COOKIE_HEADER, 'Origin': 'http://127.0.0.1:5173'}).status_code == 200


def test_expired_redis_session_cannot_be_used(client, redis_client, settings):
    result = register(client)
    claims = jwt.decode(result['access_token'], options={'verify_signature': False})
    redis_client.expire(f"{settings.redis_prefix}refresh:{claims['sid']}", 0)
    assert client.get('/api/profile').status_code == 401
    assert client.post('/api/auth/refresh', headers=COOKIE_HEADER).status_code == 401


def test_redis_unavailability_fails_closed(client, redis_client, monkeypatch):
    register(client)
    monkeypatch.setattr(redis_client, 'hget', lambda *args: (_ for _ in ()).throw(ConnectionError('unavailable')))
    response = client.get('/api/profile')
    assert response.status_code == 503
    assert 'Сервис сессий' in response.json()['detail']


def test_weak_password_validation_and_rate_limit(client):
    invalid = client.post('/api/auth/register', json={'email': 'valid@example.com', 'display_name': 'Имя', 'password': 'short'})
    assert invalid.status_code == 422
    assert '"short"' not in invalid.text and '"input"' not in invalid.text
    assert client.post('/api/auth/register', json={'email': 'invalid', 'display_name': 'Имя', 'password': 'valid-password'}).status_code == 422
    client.app.state.settings.auth_rate_limit = 2
    # Validation requests above also count; use a new connection host for deterministic quota.
    with TestClient(client.app, client=('rate-limit-client', 50000)) as other:
        for _ in range(2):
            assert other.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'wrong'}).status_code == 401
        assert other.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'wrong'}).status_code == 429


def test_guest_data_moves_once_to_a_registered_account_without_granting_legacy_header_access(settings, redis_client):
    guest = str(uuid4())
    artifact = str(uuid4())
    with sqlite3.connect(settings.storage_dir / 'sketching.sqlite3') as db:
        db.executescript('''
          CREATE TABLE progress (learner TEXT, lesson_id TEXT, seen_steps TEXT, checks TEXT, completed INTEGER, updated_at TEXT, PRIMARY KEY(learner,lesson_id));
          CREATE TABLE artworks (id TEXT PRIMARY KEY, learner TEXT, lesson_id TEXT, title TEXT, description TEXT, filename TEXT, created_at TEXT);
          CREATE TABLE favorites (learner TEXT, artwork_id TEXT, PRIMARY KEY(learner,artwork_id));
        ''')
        db.execute('INSERT INTO progress VALUES (?,?,?,?,?,?)', (guest, 'line', '[0,1,2,3]', '[true,true,true]', 1, '2026-11-10T00:00:00+00:00'))
        db.execute('INSERT INTO artworks VALUES (?,?,?,?,?,?,?)', (artifact, guest, 'line', 'Старая работа', '', 'old.jpg', '2026-11-10T00:00:00+00:00'))
        db.execute('INSERT INTO favorites VALUES (?,?)', (guest, 'demo-coupe'))
    with TestClient(create_app(settings=settings, redis_client=redis_client)) as client:
        result = register(client, legacy_profile_id=guest)
        assert result['guest_imported'] is True
        assert client.get('/api/profile').json()['percent'] == 20
        assert client.get('/api/gallery').json()[0]['id'] == artifact
        assert next(i for i in client.get('/api/gallery').json() if i['id'] == 'demo-coupe')['favorite']
        assert client.get('/api/profile', headers={'Authorization': '', 'X-Learner-ID': guest}).status_code == 401
        second = client.post('/api/auth/register', json={'email': 'second@example.com', 'display_name': 'Второй', 'password': 'valid-password', 'legacy_profile_id': guest})
        assert second.status_code == 409
        stolen = client.post('/api/auth/register', json={'email': 'third@example.com', 'display_name': 'Третий', 'password': 'valid-password', 'legacy_profile_id': result['user']['id']})
        assert stolen.status_code == 409
        assert client.get('/api/profile').json()['percent'] == 20
