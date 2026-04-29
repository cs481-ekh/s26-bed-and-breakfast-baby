from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("housing", "0011_convert_idoc_id_to_plaintext"),
    ]

    operations = [
        migrations.AddField(
            model_name="invite",
            name="provider",
            field=models.ForeignKey(
                blank=True,
                help_text="Linked provider when invite role is housing provider",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="invites",
                to="housing.provider",
            ),
        ),
    ]
