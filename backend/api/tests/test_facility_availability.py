import pytest

from housing.models import Bed, District, Facility, Parolee, Provider


@pytest.mark.django_db
def test_facility_availability_uses_assigned_beds(client):
    district = District.objects.create(number=1, name="North")
    provider = Provider.objects.create(name="Provider A")

    facility = Facility.objects.create(
        provider=provider,
        name="Sunrise House",
        address="123 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        tier=Facility.Tier.TIER_1,
    )

    bed_a = Bed.objects.create(facility=facility, label="Room 1 - A")
    Bed.objects.create(facility=facility, label="Room 1 - B")

    Parolee.objects.create(
        idoc_id="IDOC-100",
        first_name="Pat",
        last_name="Taylor",
        district=district,
        assigned_bed=bed_a,
    )

    resp = client.get("/api/facilities/availability/")

    assert resp.status_code == 200
    body = resp.json()

    assert len(body) == 1
    record = body[0]
    assert record["facility_name"] == "Sunrise House"
    assert record["total_beds"] == 2
    assert record["assigned_beds"] == 1
    assert record["available_beds"] == 1
    assert record["is_active"] is True


@pytest.mark.django_db
def test_facility_availability_includes_facilities_with_zero_beds(client):
    district = District.objects.create(number=2, name="South")
    provider = Provider.objects.create(name="Provider Z")

    Facility.objects.create(
        provider=provider,
        name="Empty Facility",
        address="100 Empty Ln",
        city="Nampa",
        state="ID",
        zip_code="83651",
        district=district,
        tier=Facility.Tier.TIER_2,
    )

    resp = client.get("/api/facilities/availability/")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["total_beds"] == 0
    assert body[0]["assigned_beds"] == 0
    assert body[0]["available_beds"] == 0


@pytest.mark.django_db
def test_facility_availability_excludes_inactive_facilities(client):
    district = District.objects.create(number=3, name="West")
    provider = Provider.objects.create(name="Provider Inactive")

    Facility.objects.create(
        provider=provider,
        name="Inactive Facility",
        address="500 Hidden Rd",
        city="Caldwell",
        state="ID",
        zip_code="83605",
        district=district,
        tier=Facility.Tier.TIER_3,
        is_active=False,
    )

    resp = client.get("/api/facilities/availability/")

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.django_db
def test_facility_availability_include_inactive_query_param(client):
    district = District.objects.create(number=4, name="East")
    provider = Provider.objects.create(name="Provider Mixed")

    Facility.objects.create(
        provider=provider,
        name="Active Facility",
        address="10 Active St",
        city="Boise",
        state="ID",
        zip_code="83702",
        district=district,
        tier=Facility.Tier.TIER_1,
        is_active=True,
    )
    Facility.objects.create(
        provider=provider,
        name="Inactive Facility",
        address="20 Inactive St",
        city="Boise",
        state="ID",
        zip_code="83702",
        district=district,
        tier=Facility.Tier.TIER_2,
        is_active=False,
    )

    resp = client.get("/api/facilities/availability/?include_inactive=true")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2

    names_to_active = {item["facility_name"]: item["is_active"] for item in body}
    assert names_to_active["Active Facility"] is True
    assert names_to_active["Inactive Facility"] is False
