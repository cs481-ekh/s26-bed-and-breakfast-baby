from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("housing", "0003_merge_20260401_0001"),
    ]

    operations = [
        migrations.AddField(
            model_name="bed",
            name="is_sex_offender_bed",
            field=models.BooleanField(
                default=False,
                help_text="Whether this bed is designated for sex-offender eligible placements",
            ),
        ),
    ]
