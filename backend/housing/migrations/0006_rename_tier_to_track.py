# Generated migration for renaming tier to track and updating choices

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('housing', '0005_alter_bed_id_alter_district_id_alter_facility_id_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='facility',
            name='tier',
            field=models.CharField(
                choices=[('basic', 'Basic'), ('plus', 'Plus'), ('hotel', 'Hotel')],
                help_text='IDOC housing track standard',
                max_length=10,
            ),
        ),
        migrations.RenameField(
            model_name='facility',
            old_name='tier',
            new_name='track',
        ),
    ]
