# Properly convert idoc_id from encrypted to plaintext

from django.db import migrations, models
from django.db.models import F, Value
from django.db.models.functions import Left


def decrypt_idoc_id_values(apps, schema_editor):
    """
    Extract plaintext idoc_id values from encrypted data.
    Encrypted values start with 'gAAAAA', plaintext values are short (like 'IDOC-20001').
    """
    from housing.encryption import Fernet, get_encryption_key
    
    Parolee = apps.get_model('housing', 'Parolee')
    cipher = Fernet(get_encryption_key())
    
    decrypted_values = {}
    for parolee in Parolee.objects.all():
        encrypted_value = parolee.idoc_id
        
        # Try to decrypt
        if encrypted_value and isinstance(encrypted_value, str):
            # If it looks encrypted (Fernet format), decrypt it
            if encrypted_value.startswith('gAAAAA'):
                try:
                    decrypted = cipher.decrypt(encrypted_value.encode()).decode('utf-8')
                    decrypted_values[parolee.id] = decrypted
                except Exception as e:
                    # If decryption fails, assume it's already plaintext
                    decrypted_values[parolee.id] = encrypted_value
            else:
                # Already plaintext
                decrypted_values[parolee.id] = encrypted_value
    
    # Update the database with plaintext values using raw SQL
    # This avoids the ORM re-encrypting the values
    if decrypted_values:
        with schema_editor.connection.cursor() as cursor:
            for parolee_id, plaintext_value in decrypted_values.items():
                cursor.execute(
                    'UPDATE housing_parolee SET idoc_id = %s WHERE id = %s',
                    [plaintext_value, parolee_id]
                )


def reverse_decrypt(apps, schema_editor):
    """Reverse is a no-op since we can't re-encrypt without the original plaintext"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('housing', '0010_alter_parolee_idoc_id'),
    ]

    operations = [
        # Decrypt all values first
        migrations.RunPython(decrypt_idoc_id_values, reverse_decrypt),
        # Then safely alter the field
        migrations.AlterField(
            model_name='parolee',
            name='idoc_id',
            field=models.CharField(
                max_length=50,
                unique=True,
                help_text='IDOC-assigned identifier',
            ),
        ),
    ]
