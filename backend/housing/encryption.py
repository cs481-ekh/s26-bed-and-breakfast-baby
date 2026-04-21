"""
Custom encrypted field implementations using cryptography library.
Provides field-level encryption for sensitive data in the database.
"""

from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet
import base64
import hashlib


def get_encryption_key():
    """
    Derive encryption key from Django's SECRET_KEY.
    Ensures the same key is used for all encryption/decryption.
    Fernet requires a 32-byte key that's base64-encoded to 44 bytes.
    """
    # Use SHA256 to hash SECRET_KEY to 32 bytes
    key = settings.SECRET_KEY.encode()
    hashed = hashlib.sha256(key).digest()
    # Base64 encode and return as bytes (Fernet expects bytes)
    return base64.urlsafe_b64encode(hashed)


class EncryptedField(models.TextField):
    """
    Base encrypted field using Fernet symmetric encryption.
    Encrypts data before storing in database, decrypts on retrieval.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cipher = None

    @property
    def cipher(self):
        """Lazy-load cipher to avoid initializing before Django settings are ready."""
        if self._cipher is None:
            self._cipher = Fernet(get_encryption_key())
        return self._cipher

    def get_prep_value(self, value):
        """Encrypts the plaintext value before database storage."""
        if value is None or value == '':
            return value
        
        if not isinstance(value, str):
            value = str(value)
        
        try:
            encrypted = self.cipher.encrypt(value.encode())
            return encrypted.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Encryption failed: {e}")

    def from_db_value(self, value, expression, connection):
        """Decrypts the encrypted value after retrieval from database."""
        if value is None or value == '':
            return value
        
        try:
            decrypted = self.cipher.decrypt(value.encode())
            return decrypted.decode('utf-8')
        except Exception:
            return value

    def to_python(self, value):
        """Converts DB value to Python."""
        if value is None or value == '':
            return value
        
        if isinstance(value, str) and value.startswith('gAAAAA'):
            try:
                decrypted = self.cipher.decrypt(value.encode())
                return decrypted.decode('utf-8')
            except Exception:
                return value
        
        return value


class EncryptedCharField(models.CharField):
    """
    Encrypted CharField for smaller strings (emails, phone numbers, IDs).
    Uses Fernet symmetric encryption.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cipher = None

    @property
    def cipher(self):
        """Lazy-load cipher to avoid initializing before Django settings are ready."""
        if self._cipher is None:
            self._cipher = Fernet(get_encryption_key())
        return self._cipher

    def get_prep_value(self, value):
        """Encrypts before saving."""
        if value is None or value == '':
            return value
        
        if not isinstance(value, str):
            value = str(value)
        
        try:
            encrypted = self.cipher.encrypt(value.encode())
            return encrypted.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Encryption failed: {e}")

    def from_db_value(self, value, expression, connection):
        """Decrypts after retrieval."""
        if value is None or value == '':
            return value
        
        try:
            decrypted = self.cipher.decrypt(value.encode())
            return decrypted.decode('utf-8')
        except Exception:
            return value

    def to_python(self, value):
        """Converts DB value to Python."""
        if value is None or value == '':
            return value
        
        if isinstance(value, str) and value.startswith('gAAAAA'):
            try:
                decrypted = self.cipher.decrypt(value.encode())
                return decrypted.decode('utf-8')
            except Exception:
                return value
        
        return value
