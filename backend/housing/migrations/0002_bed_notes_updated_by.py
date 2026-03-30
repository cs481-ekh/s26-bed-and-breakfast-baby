from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("housing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="bed",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="bed",
            name="updated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="updated_beds",
                to="housing.user",
            ),
        ),
    ]
