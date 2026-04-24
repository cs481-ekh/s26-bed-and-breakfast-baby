from datetime import timedelta

import pytest
from django.utils import timezone

from housing.models import District, Parolee, User


@pytest.mark.django_db
def test_admin_clients_requires_authentication(client):
    response = client.get("/api/admin/clients/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_clients_requires_admin_role(client):
    case_manager = User.objects.create_user(
        username="case_manager_user",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
    )

    client.force_login(case_manager)
    response = client.get("/api/admin/clients/")

    assert response.status_code == 403
    assert "administrators" in response.json()["error"].lower()


@pytest.mark.django_db
def test_admin_clients_returns_only_clients_older_than_24_months(client):
    admin_user = User.objects.create_user(
        username="admin_user",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    district = District.objects.create(number=1, name="First")

    older_client = Parolee.objects.create(
        idoc_id="IDOC-OLD-1",
        first_name="Older",
        last_name="Client",
        district=district,
    )
    recent_client = Parolee.objects.create(
        idoc_id="IDOC-NEW-1",
        first_name="Recent",
        last_name="Client",
        district=district,
    )

    old_created_at = timezone.now() - timedelta(days=760)
    recent_created_at = timezone.now() - timedelta(days=200)
    Parolee.objects.filter(pk=older_client.pk).update(created_at=old_created_at)
    Parolee.objects.filter(pk=recent_client.pk).update(created_at=recent_created_at)

    client.force_login(admin_user)
    response = client.get("/api/admin/clients/")

    assert response.status_code == 200
    payload = response.json()
    returned_ids = {entry["idoc_id"] for entry in payload}

    assert "IDOC-OLD-1" in returned_ids
    assert "IDOC-NEW-1" not in returned_ids

    older_row = next(entry for entry in payload if entry["idoc_id"] == "IDOC-OLD-1")
    assert older_row["months_in_system"] >= 24
    assert older_row["date_added"] == old_created_at.date().isoformat()
