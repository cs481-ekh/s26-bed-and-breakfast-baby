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
        track=Facility.Track.BASIC,
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
        track=Facility.Track.PLUS,
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
        track=Facility.Track.HOTEL,
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
        track=Facility.Track.BASIC,
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
        track=Facility.Track.PLUS,
        is_active=False,
    )

    resp = client.get("/api/facilities/availability/?include_inactive=true")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2

    names_to_active = {item["facility_name"]: item["is_active"] for item in body}
    assert names_to_active["Active Facility"] is True
    assert names_to_active["Inactive Facility"] is False


@pytest.mark.django_db
def test_facility_availability_filters_district_gender_and_sex_offender(client):
    district_1 = District.objects.create(number=1, name="District One")
    district_2 = District.objects.create(number=2, name="District Two")
    provider = Provider.objects.create(name="Provider Filters")

    Facility.objects.create(
        provider=provider,
        name="Matches Filters",
        address="10 Match St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district_1,
        track=Facility.Track.BASIC,
        accepts_male=True,
        accepts_female=False,
        accepts_sex_offender=True,
    )

    Facility.objects.create(
        provider=provider,
        name="Wrong District",
        address="20 District Ave",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district_2,
        track=Facility.Track.BASIC,
        accepts_male=True,
        accepts_female=False,
        accepts_sex_offender=True,
    )

    Facility.objects.create(
        provider=provider,
        name="No Sex Offender",
        address="30 Rules Rd",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district_1,
        track=Facility.Track.PLUS,
        accepts_male=True,
        accepts_female=False,
        accepts_sex_offender=False,
    )

    resp = client.get("/api/facilities/availability/?district=1&gender=male&sex_offender=true")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["facility_name"] == "Matches Filters"


@pytest.mark.django_db
def test_facility_availability_supports_multiple_district_and_gender_filters(client):
    district_1 = District.objects.create(number=1, name="District One")
    district_2 = District.objects.create(number=2, name="District Two")
    provider = Provider.objects.create(name="Provider Multi")

    Facility.objects.create(
        provider=provider,
        name="Male Only One",
        address="10 A St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district_1,
        track=Facility.Track.BASIC,
        accepts_male=True,
        accepts_female=False,
    )
    Facility.objects.create(
        provider=provider,
        name="Female Only Two",
        address="20 B St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district_2,
        track=Facility.Track.BASIC,
        accepts_male=False,
        accepts_female=True,
    )
    Facility.objects.create(
        provider=provider,
        name="Either Three",
        address="30 C St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district_2,
        track=Facility.Track.PLUS,
        accepts_male=True,
        accepts_female=True,
    )

    resp = client.get("/api/facilities/availability/?district=1&district=2&gender=male&gender=female")

    assert resp.status_code == 200
    body = resp.json()
    assert {item["facility_name"] for item in body} == {"Male Only One", "Female Only Two"}


@pytest.mark.django_db
def test_facility_availability_filters_by_sex_offender_bed_presence(client):
    district = District.objects.create(number=3, name="District Three")
    provider = Provider.objects.create(name="Provider SO Beds")

    with_so_beds = Facility.objects.create(
        provider=provider,
        name="With S/O Beds",
        address="40 D St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
        accepts_sex_offender=True,
    )
    without_so_beds = Facility.objects.create(
        provider=provider,
        name="Without S/O Beds",
        address="50 E St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )

    Bed.objects.create(facility=with_so_beds, label="Bed 1", is_sex_offender_bed=True)
    Bed.objects.create(facility=with_so_beds, label="Bed 2")
    Bed.objects.create(facility=without_so_beds, label="Bed 1")

    has_resp = client.get("/api/facilities/availability/?so_beds=has")
    assert has_resp.status_code == 200
    has_body = has_resp.json()
    assert {item["facility_name"] for item in has_body} == {"With S/O Beds"}
    assert has_body[0]["has_sex_offender_beds"] is True

    none_resp = client.get("/api/facilities/availability/?so_beds=none")
    assert none_resp.status_code == 200
    none_body = none_resp.json()
    assert {item["facility_name"] for item in none_body} == {"Without S/O Beds"}
    assert none_body[0]["has_sex_offender_beds"] is False


@pytest.mark.django_db
def test_facility_beds_are_sorted_with_sex_offender_beds_first(client):
    district = District.objects.create(number=4, name="District Four")
    provider = Provider.objects.create(name="Provider Order")
    facility = Facility.objects.create(
        provider=provider,
        name="Ordering House",
        address="60 F St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
        accepts_sex_offender=True,
    )

    Bed.objects.create(facility=facility, label="Bed 10")
    Bed.objects.create(facility=facility, label="S/O Bed 2", is_sex_offender_bed=True)
    Bed.objects.create(facility=facility, label="Bed 2")
    Bed.objects.create(facility=facility, label="S/O Bed 1", is_sex_offender_bed=True)
    Bed.objects.create(facility=facility, label="Bed 1")

    resp = client.get(f"/api/facilities/{facility.id}/beds/")

    assert resp.status_code == 200
    body = resp.json()
    assert [bed["label"] for bed in body] == [
        "S/O Bed 1",
        "S/O Bed 2",
        "Bed 1",
        "Bed 2",
        "Bed 10",
    ]
