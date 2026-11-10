import hashlib
import time
from backend.core.errors import AppError, unauthorized

# Compare and rotate in one Redis command: two requests cannot consume the same token.
ROTATE = """
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
if redis.call('HGET', KEYS[1], 'user_id') ~= ARGV[1] then return 0 end
if redis.call('HGET', KEYS[1], 'digest') ~= ARGV[2] then
    redis.call('DEL', KEYS[1])
    return -1
end
redis.call('HSET', KEYS[1], 'digest', ARGV[3])
return 1
"""
LIMIT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return count
"""


class SessionRepository:
    def __init__(self, client, prefix):
        self.client = client
        self.prefix = prefix

    def key(self, session_id):
        return f"{self.prefix}refresh:{session_id}"

    @staticmethod
    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def create(self, session_id, user_id, token, expires_at):
        with self.client.pipeline(transaction=True) as pipe:
            pipe.hset(self.key(session_id), mapping={"user_id": user_id, "digest": self.digest(token)})
            pipe.expireat(self.key(session_id), expires_at)
            pipe.execute()

    def active(self, session_id, user_id):
        return self.client.hget(self.key(session_id), "user_id") == user_id

    def rotate(self, session_id, user_id, old_token, new_token):
        result = self.client.eval(ROTATE, 1, self.key(session_id), user_id, self.digest(old_token), self.digest(new_token))
        if result != 1:
            raise unauthorized("Refresh-токен истёк, отозван или уже использован. Войди снова.")

    def revoke(self, session_id):
        self.client.delete(self.key(session_id))

    def rate_limit(self, identifier, maximum):
        key = f"{self.prefix}auth-limit:{hashlib.sha256(identifier.encode()).hexdigest()}"
        if self.client.eval(LIMIT, 1, key) > maximum:
            raise AppError(429, "Слишком много попыток. Подожди минуту и попробуй снова.")
