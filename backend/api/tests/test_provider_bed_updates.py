import pytest

from housing.models import Bed, District, Facility, Parolee, Provider, User


@pytest.mark.django_db
def test_provider_can_assign_client_by_existing_idoc_record(client):
    district = District.objects.create(number=1, name="North")
    provider = Provider.objects.create(name="Provider A")

    provider_user = User.objects.create_user(
        username="provider_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="Provider Facility",
        address="123 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )

    bed = Bed.objects.create(facility=facility, label="Room 1 - A")
    parolee = Parolee.objects.create(
        idoc_id="IDOC-20001",
        first_name="Alex",
        last_name="Rivera",
        district=district,
    )

    client.force_login(provider_user)
    resp = client.post(
        "/api/provider/assign-client/",
        data={"bed_id": bed.id, "idoc_id": parolee.idoc_id},
        content_type="application/json",
    )

    assert resp.status_code == 200

    bed.refresh_from_db()
    parolee.refresh_from_db()
    assert bed.status == Bed.Status.OCCUPIED
    assert parolee.assigned_bed_id == bed.id


@pytest.mark.django_db
def test_non_provider_cannot_assign_client(client):
    district = District.objects.create(number=2, name="South")
    provider = Provider.objects.create(name="Provider B")

    case_manager = User.objects.create_user(
        username="case_mgr",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
        district=district,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="Facility B",
        address="456 Oak St",
        city="Nampa",
        state="ID",
        zip_code="83651",
        district=district,
        track=Facility.Track.PLUS,
    )

    bed = Bed.objects.create(facility=facility, label="Room 1 - B")
    parolee = Parolee.objects.create(
        idoc_id="IDOC-20002",
        first_name="Morgan",
        last_name="Lee",
        district=district,
    )

    client.force_login(case_manager)
    resp = client.post(
        "/api/provider/assign-client/",
        data={"bed_id": bed.id, "idoc_id": parolee.idoc_id},
        content_type="application/json",
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_provider_beds_are_sorted_with_sex_offender_beds_first(client):
    district = District.objects.create(number=3, name="East")
    provider = Provider.objects.create(name="Provider Sort")

    provider_user = User.objects.create_user(
        username="provider_sort_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    first_facility = Facility.objects.create(
        provider=provider,
        name="Alpha House",
        address="100 First St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
        accepts_sex_offender=True,
    )
    second_facility = Facility.objects.create(
        provider=provider,
        name="Beta House",
        address="200 Second St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )

    Bed.objects.create(facility=second_facility, label="Bed 3")
    Bed.objects.create(facility=first_facility, label="Bed 10")
    Bed.objects.create(facility=first_facility, label="S/O Bed 2", is_sex_offender_bed=True)
    Bed.objects.create(facility=first_facility, label="Bed 2")
    Bed.objects.create(facility=first_facility, label="S/O Bed 1", is_sex_offender_bed=True)
    Bed.objects.create(facility=first_facility, label="Bed 1")

    client.force_login(provider_user)
    resp = client.get("/api/provider/beds/")

    assert resp.status_code == 200
    body = resp.json()
    assert [bed["bed_label"] for bed in body] == [
        "S/O Bed 1",
        "S/O Bed 2",
        "Bed 1",
        "Bed 2",
        "Bed 10",
        "Bed 3",
    ]


@pytest.mark.django_db
def test_provider_beds_returns_null_client_fields_for_unassigned_beds(client):
    district = District.objects.create(number=4, name="West")
    provider = Provider.objects.create(name="Provider Null Client")

    provider_user = User.objects.create_user(
        username="provider_null_client_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="Null Client House",
        address="300 Third St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )

    unassigned_bed = Bed.objects.create(facility=facility, label="Bed 1")

    client.force_login(provider_user)
    resp = client.get("/api/provider/beds/")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["bed_id"] == unassigned_bed.id
    assert body[0]["client_id"] is None
    assert body[0]["client_name"] is None
