"""Lightweight Fernet encryption for sensitive budget-level settings."""

import logging
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)
_ENCRYPTION_KEY = os.environ.get("DOSH_ENCRYPTION_SECRET", "").strip()


def encryption_ready() -> bool:
    """Return True if the encryption secret is configured and operational."""
    return bool(_ENCRYPTION_KEY)


def _get_fernet() -> Fernet | None:
    if not _ENCRYPTION_KEY:
        return None
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"dosh-static-salt-v1",  # salt is not secret; key material is
        iterations=480_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(_ENCRYPTION_KEY.encode()))
    return Fernet(key)


def encrypt_value(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    fernet = _get_fernet()
    if not fernet:
        return None
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    fernet = _get_fernet()
    if not fernet:
        return None
    return fernet.decrypt(ciphertext.encode()).decode()
