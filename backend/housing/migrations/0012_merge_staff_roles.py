from django.db import migrations, models


def merge_staff_roles(apps, schema_editor):
    User = apps.get_model("housing", "User")
    Invite = apps.get_model("housing", "Invite")

    User.objects.filter(role__in=["case_manager", "parole_officer"]).update(role="idoc_staff")
    Invite.objects.filter(role__in=["case_manager", "parole_officer"]).update(role="idoc_staff")


class Migration(migrations.Migration):
    dependencies = [
        ("housing", "0011_convert_idoc_id_to_plaintext"),
    ]

    operations = [
        migrations.RunPython(merge_staff_roles, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Administrator"),
                    ("idoc_staff", "IDOC Staff"),
                    ("provider", "Housing Provider"),
                ],
                default="idoc_staff",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="invite",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Administrator"),
                    ("idoc_staff", "IDOC Staff"),
                    ("provider", "Housing Provider"),
                ],
                default="idoc_staff",
                max_length=20,
            ),
        ),
    ]

