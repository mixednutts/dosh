"""Lightweight Fernet encryption for sensitive budget-level settings.

Each ciphertext includes a random 16-byte salt prepended to the Fernet
payload so that identical plaintexts encrypt to different outputs and
rainbow-table attacks are infeasible.
"""

import logging
import os
import base64
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)
_ENCRYPTION_KEY = os.environ.get("DOSH_ENCRYPTION_SECRET", "").strip()

_SALT_LENGTH = 16


def encryption_ready() -> bool:
    """Return True if the encryption secret is configured and operational."""
    return bool(_ENCRYPTION_KEY)


def _derive_key(salt: bytes) -> bytes:
    """Derive a urlsafe base64-encoded Fernet key from the global secret and a salt."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(_ENCRYPTION_KEY.encode()))


def encrypt_value(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    if not _ENCRYPTION_KEY:
        return None
    salt = secrets.token_bytes(_SALT_LENGTH)
    fernet = Fernet(_derive_key(salt))
    token = fernet.encrypt(plaintext.encode())
    # Prepend salt so decryption can recover it
    return base64.urlsafe_b64encode(salt + token).decode()


def decrypt_value(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    if not _ENCRYPTION_KEY:
        return None
    raw = base64.urlsafe_b64decode(ciphertext.encode())
    salt = raw[:_SALT_LENGTH]
    token = raw[_SALT_LENGTH:]
    fernet = Fernet(_derive_key(salt))
    try:
        return fernet.decrypt(token).decode()
    except Exception:
        # Legacy ciphertext without embedded salt — fall back to old static salt
        legacy_fernet = Fernet(_derive_key(b"dosh-static-salt-v1"))
        return legacy_fernet.decrypt(raw).decode()
