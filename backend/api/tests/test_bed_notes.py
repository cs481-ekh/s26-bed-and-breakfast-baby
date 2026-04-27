import pytest

from housing.models import Bed, District, Facility, Provider, User


@pytest.mark.django_db
def test_non_admin_cannot_edit_bed_notes(client):
    district = District.objects.create(number=8, name="Notes District")
    provider = Provider.objects.create(name="Notes Provider")
    facility = Facility.objects.create(
        provider=provider,
        name="Notes House",
        address="1 Main",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed 1", notes="Existing note")
    non_admin = User.objects.create_user(
        username="staff_user",
        password="testpass123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(non_admin)
    resp = client.patch(
        f"/api/beds/{bed.id}/notes/",
        data={"notes": "Updated note"},
        content_type="application/json",
    )

    assert resp.status_code == 403
    bed.refresh_from_db()
    assert bed.notes == "Existing note"


@pytest.mark.django_db
def test_admin_can_edit_bed_notes(client):
    district = District.objects.create(number=9, name="Admin District")
    provider = Provider.objects.create(name="Admin Provider")
    facility = Facility.objects.create(
        provider=provider,
        name="Admin House",
        address="2 Main",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )
    bed = Bed.objects.create(facility=facility, label="Bed 2", notes="Old")
    admin_user = User.objects.create_user(
        username="admin_user",
        password="testpass123",
        role=User.Role.ADMIN,
    )

    client.force_login(admin_user)
    resp = client.patch(
        f"/api/beds/{bed.id}/notes/",
        data={"notes": "New admin note"},
        content_type="application/json",
    )

    assert resp.status_code == 200
    bed.refresh_from_db()
    assert bed.notes == "New admin note"
    assert bed.updated_by_id == admin_user.id
