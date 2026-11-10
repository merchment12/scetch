import os
from uuid import uuid4
import pytest
from redis import Redis
from pydantic import SecretStr
from backend.core.config import Settings


@pytest.fixture
def settings(tmp_path):
    config = Settings(storage_dir=tmp_path, jwt_secret=SecretStr('test-signing-secret-only-for-tests-0123456789'),
                    redis_url=os.environ.get('TEST_REDIS_URL', 'redis://127.0.0.1:6380/0'), redis_prefix=f'test:{uuid4()}:', auth_rate_limit=1000)
    assert config.storage_dir == tmp_path, 'Tests must never use application storage'
    return config


@pytest.fixture
def redis_client(settings):
    client = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
    client.ping()
    yield client
    # Only remove this test's random namespace. Never flush the user's Redis database.
    for key in client.scan_iter(match=f'{settings.redis_prefix}*'):
        client.delete(key)
    client.close()


def register(client, email='designer@example.com', **extra):
    response = client.post('/api/auth/register', json={'email': email, 'password': 'draw-some-lines-2026', 'display_name': 'Транспортный дизайнер', **extra})
    assert response.status_code == 201, response.text
    data = response.json()
    client.headers['Authorization'] = f"Bearer {data['access_token']}"
    return data
