from __future__ import annotations

import hashlib
import hmac
import os


def worker_api_key() -> str:
    value = os.getenv("WORKER_API_KEY")
    if not value:
        raise RuntimeError("WORKER_API_KEY must be set")
    return value


def assert_bearer_token(auth_header: str | None) -> None:
    if not auth_header:
        raise PermissionError("Missing authorization header")

    expected = f"Bearer {worker_api_key()}"
    if not hmac.compare_digest(auth_header, expected):
        raise PermissionError("Invalid bearer token")


def sign_payload(secret: str, body: str) -> str:
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
