from django.db import migrations, models
from django.db.models.deletion import PROTECT
from housing.encryption import EncryptedField


class Migration(migrations.Migration):

    dependencies = [
        ("housing", "0013_merge_0012_invite_provider_0012_merge_staff_roles"),
    ]

    operations = [
        migrations.AddField(
            model_name="provider",
            name="district",
            field=models.ForeignKey(
                to="housing.district",
                on_delete=PROTECT,
                null=True,
                blank=True,
                related_name="providers",
            ),
        ),
        migrations.AddField(
            model_name="provider",
            name="address",
            field=EncryptedField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="provider",
            name="notes",
            field=EncryptedField(blank=True, null=True),
        ),
    ]

