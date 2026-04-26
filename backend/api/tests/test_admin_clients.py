from datetime import timedelta

import pytest
from django.utils import timezone

from housing.models import Bed, District, Facility, Parolee, Provider, User


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
def test_admin_clients_returns_all_clients_sorted_by_months_desc(client):
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
    assert "IDOC-NEW-1" in returned_ids

    older_row = next(entry for entry in payload if entry["idoc_id"] == "IDOC-OLD-1")
    recent_row = next(entry for entry in payload if entry["idoc_id"] == "IDOC-NEW-1")

    assert older_row["months_in_system"] >= 24
    assert older_row["date_added"] == old_created_at.date().isoformat()
    assert older_row["months_in_system"] > recent_row["months_in_system"]

    ordered_months = [entry["months_in_system"] for entry in payload]
    assert ordered_months == sorted(ordered_months, reverse=True)


@pytest.mark.django_db
def test_admin_client_remove_requires_admin_role(client):
    case_manager = User.objects.create_user(
        username="case_manager_user_remove",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
    )
    district = District.objects.create(number=2, name="Second")
    parolee = Parolee.objects.create(
        idoc_id="IDOC-RM-403",
        first_name="No",
        last_name="Access",
        district=district,
    )

    client.force_login(case_manager)
    response = client.post(f"/api/admin/clients/{parolee.id}/remove/", {}, content_type="application/json")

    assert response.status_code == 403
    assert Parolee.objects.filter(pk=parolee.id).exists()


@pytest.mark.django_db
def test_admin_client_remove_rejects_assigned_client(client):
    admin_user = User.objects.create_user(
        username="admin_remove_guard",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    district = District.objects.create(number=3, name="Third")
    provider = Provider.objects.create(name="Provider A")
    facility = Facility.objects.create(
        provider=provider,
        name="Facility A",
        city="Boise",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed 1", status=Bed.Status.OCCUPIED)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-RM-409",
        first_name="Still",
        last_name="Assigned",
        district=district,
        assigned_bed=bed,
    )

    client.force_login(admin_user)
    response = client.post(f"/api/admin/clients/{parolee.id}/remove/", {}, content_type="application/json")

    assert response.status_code == 409
    assert "unassign" in response.json()["error"].lower()
    assert Parolee.objects.filter(pk=parolee.id).exists()


@pytest.mark.django_db
def test_admin_client_remove_deletes_unassigned_client(client):
    admin_user = User.objects.create_user(
        username="admin_remove_ok",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    district = District.objects.create(number=4, name="Fourth")
    parolee = Parolee.objects.create(
        idoc_id="IDOC-RM-200",
        first_name="Ready",
        last_name="Removal",
        district=district,
    )

    client.force_login(admin_user)
    response = client.post(f"/api/admin/clients/{parolee.id}/remove/", {}, content_type="application/json")

    assert response.status_code == 200
    assert "removed client" in response.json()["message"].lower()
    assert not Parolee.objects.filter(pk=parolee.id).exists()
