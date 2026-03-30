import pytest

from housing.models import Bed, District, Facility, Parolee, Provider


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
        tier=Facility.Tier.TIER_1,
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
        tier=Facility.Tier.TIER_2,
    )
    bed = Bed.objects.create(facility=facility, label="Bed B", status=Bed.Status.AVAILABLE)

    resp = client.post(f"/api/beds/{bed.id}/unassign/", data={}, content_type="application/json")

    assert resp.status_code == 409
    assert "no current assignment" in resp.json()["error"].lower()
