from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("housing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="facility",
            name="accepts_female",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="facility",
            name="accepts_male",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="facility",
            name="accepts_sex_offender",
            field=models.BooleanField(default=False),
        ),
    ]
