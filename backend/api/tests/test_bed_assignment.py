import pytest
from django.utils import timezone

from housing.models import Bed, District, Facility, Hold, Parolee, Provider, User


@pytest.mark.django_db
def test_unassign_single_bed_success(client):
    district = District.objects.create(number=6, name="Central")
    provider = Provider.objects.create(name="Provider B")
    facility = Facility.objects.create(
        provider=provider,
        name="Oak House",
        address="200 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed A", status=Bed.Status.OCCUPIED)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-501",
        first_name="Chris",
        last_name="Lee",
        district=district,
        assigned_bed=bed,
    )

    resp = client.post(f"/api/beds/{bed.id}/unassign/", data={}, content_type="application/json")

    assert resp.status_code == 200
    bed.refresh_from_db()
    parolee.refresh_from_db()
    assert bed.status == Bed.Status.AVAILABLE
    assert parolee.assigned_bed is None
    assert parolee.housing_start_date is None
    assert parolee.housing_end_date is None


@pytest.mark.django_db
def test_unassign_single_bed_without_assignment_conflict(client):
    district = District.objects.create(number=7, name="Upper")
    provider = Provider.objects.create(name="Provider C")
    facility = Facility.objects.create(
        provider=provider,
        name="Pine House",
        address="300 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )
    bed = Bed.objects.create(facility=facility, label="Bed B", status=Bed.Status.AVAILABLE)

    resp = client.post(f"/api/beds/{bed.id}/unassign/", data={}, content_type="application/json")

    assert resp.status_code == 409
    assert "no current assignment" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_request_hold_on_available_bed(client):
    district = District.objects.create(number=10, name="Hold District")
    provider = Provider.objects.create(name="Provider Hold")
    case_manager = User.objects.create_user(
        username="case_mgr_hold",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
        district=district,
    )
    facility = Facility.objects.create(
        provider=provider,
        name="Hold House",
        address="400 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed Hold", status=Bed.Status.AVAILABLE)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-601",
        first_name="Taylor",
        last_name="Young",
        district=district,
    )

    client.force_login(case_manager)
    resp = client.post(
        f"/api/beds/{bed.id}/hold/",
        data={"parolee_id": parolee.id},
        content_type="application/json",
    )

    assert resp.status_code == 200
    bed.refresh_from_db()
    assert bed.status == Bed.Status.HELD
    assert "hold requested" in bed.notes.lower()
    assert Hold.objects.filter(bed=bed, parolee=parolee, status=Hold.Status.ACTIVE).exists()


@pytest.mark.django_db
def test_request_hold_requires_case_manager_or_admin(client):
    district = District.objects.create(number=13, name="Restricted District")
    provider = Provider.objects.create(name="Provider Restricted")
    parole_officer = User.objects.create_user(
        username="po_hold",
        password="testpass123",
        role=User.Role.PAROLE_OFFICER,
        district=district,
    )
    facility = Facility.objects.create(
        provider=provider,
        name="Restricted House",
        address="405 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed Restricted", status=Bed.Status.AVAILABLE)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-602",
        first_name="Riley",
        last_name="Gray",
        district=district,
    )

    client.force_login(parole_officer)
    resp = client.post(
        f"/api/beds/{bed.id}/hold/",
        data={"parolee_id": parolee.id},
        content_type="application/json",
    )

    assert resp.status_code == 403
    assert "only case managers and admins" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_request_hold_requires_parolee(client):
    district = District.objects.create(number=12, name="Hold Required District")
    provider = Provider.objects.create(name="Provider Hold Required")
    case_manager = User.objects.create_user(
        username="case_mgr_hold_required",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
        district=district,
    )
    facility = Facility.objects.create(
        provider=provider,
        name="Hold Required House",
        address="410 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed Hold Required", status=Bed.Status.AVAILABLE)

    client.force_login(case_manager)
    resp = client.post(f"/api/beds/{bed.id}/hold/", data={}, content_type="application/json")

    assert resp.status_code == 400
    assert "parolee_id is required" in resp.json()["error"].lower()


@pytest.mark.django_db
def test_unassign_releases_held_bed(client):
    district = District.objects.create(number=11, name="Release District")
    provider = Provider.objects.create(name="Provider Release")
    facility = Facility.objects.create(
        provider=provider,
        name="Release House",
        address="500 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )
    bed = Bed.objects.create(facility=facility, label="Bed Held", status=Bed.Status.HELD)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-701",
        first_name="Jordan",
        last_name="West",
        district=district,
    )
    hold = Hold.objects.create(
        bed=bed,
        parolee=parolee,
        reason="Test hold",
        expires_at=timezone.now(),
    )

    resp = client.post(f"/api/beds/{bed.id}/unassign/", data={}, content_type="application/json")

    assert resp.status_code == 200
    bed.refresh_from_db()
    hold.refresh_from_db()
    assert bed.status == Bed.Status.AVAILABLE
    assert "hold removed" in bed.notes.lower()
    assert hold.status == Hold.Status.CANCELLED
