import pytest
from datetime import timedelta
from django.utils import timezone

from housing.models import Bed, District, Facility, Hold, Parolee, Provider, User


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
    body = resp.json()

    bed.refresh_from_db()
    parolee.refresh_from_db()
    assert bed.status == Bed.Status.OCCUPIED
    assert parolee.assigned_bed_id == bed.id
    assert parolee.housing_start_date == timezone.now().date()
    assert parolee.housing_end_date == timezone.now().date() + timedelta(days=30)
    assert body["client_name"] == "Rivera, Alex"


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
    assert body[0]["assignment_placeholder"] == "No client assigned"


@pytest.mark.django_db
def test_provider_can_create_bed_in_own_facility(client):
    district = District.objects.create(number=5, name="Northwest")
    provider = Provider.objects.create(name="Provider Create")

    provider_user = User.objects.create_user(
        username="provider_create_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="Create House",
        address="123 Create St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )

    client.force_login(provider_user)
    resp = client.post(
        "/api/provider/beds/create/",
        data={
            "facility_id": facility.id,
            "label": "Bed New 1",
            "notes": "Ground floor bed",
            "is_sex_offender_bed": True,
        },
        content_type="application/json",
    )

    assert resp.status_code == 201
    body = resp.json()
    bed = Bed.objects.get(pk=body["bed_id"])
    assert bed.facility_id == facility.id
    assert bed.label == "Bed New 1"
    assert bed.notes == "Ground floor bed"
    assert bed.is_sex_offender_bed is True


@pytest.mark.django_db
def test_provider_cannot_create_bed_for_other_provider(client):
    district = District.objects.create(number=8, name="East Central")
    provider_a = Provider.objects.create(name="Provider A")
    provider_b = Provider.objects.create(name="Provider B")

    provider_user = User.objects.create_user(
        username="provider_other_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider_a,
    )

    facility = Facility.objects.create(
        provider=provider_b,
        name="Other House",
        address="456 Create St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )

    client.force_login(provider_user)
    resp = client.post(
        "/api/provider/beds/create/",
        data={"facility_id": facility.id, "label": "Bed Blocked"},
        content_type="application/json",
    )

    assert resp.status_code == 404


@pytest.mark.django_db
def test_provider_client_lookup_returns_name_and_assignment_fields(client):
    district = District.objects.create(number=9, name="Lookup District")
    provider = Provider.objects.create(name="Provider Lookup")

    provider_user = User.objects.create_user(
        username="provider_lookup_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    Parolee.objects.create(
        idoc_id="IDOC-90001",
        first_name="Jordan",
        last_name="Carter",
        district=district,
    )

    client.force_login(provider_user)
    resp = client.get("/api/provider/parolees/lookup/?idoc_id=IDOC-90001")

    assert resp.status_code == 200
    body = resp.json()
    assert body["full_name"] == "Carter, Jordan"
    assert body["assigned_bed_id"] is None
    assert body["housing_start_date"] is None
    assert body["housing_end_date"] is None


@pytest.mark.django_db
def test_provider_hold_can_be_approved(client):
    district = District.objects.create(number=14, name="Hold Approve District")
    provider = Provider.objects.create(name="Provider Approve")
    provider_user = User.objects.create_user(
        username="provider_approve_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )
    case_manager = User.objects.create_user(
        username="case_mgr_approve",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
        district=district,
    )
    facility = Facility.objects.create(
        provider=provider,
        name="Approve House",
        address="600 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed Approve", status=Bed.Status.HELD)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-14001",
        first_name="Sam",
        last_name="Parker",
        district=district,
    )
    hold = Hold.objects.create(
        bed=bed,
        parolee=parolee,
        placed_by=case_manager,
        reason="Awaiting provider review",
        expires_at=timezone.now() + timedelta(hours=48),
    )

    client.force_login(provider_user)
    resp = client.post(f"/api/provider/holds/{hold.id}/approve/", data={}, content_type="application/json")

    assert resp.status_code == 200
    bed.refresh_from_db()
    parolee.refresh_from_db()
    hold.refresh_from_db()
    assert bed.status == Bed.Status.OCCUPIED
    assert parolee.assigned_bed_id == bed.id
    assert parolee.housing_end_date == timezone.now().date() + timedelta(days=30)
    assert hold.status == Hold.Status.CONVERTED


@pytest.mark.django_db
def test_provider_hold_can_be_denied(client):
    district = District.objects.create(number=15, name="Hold Deny District")
    provider = Provider.objects.create(name="Provider Deny")
    provider_user = User.objects.create_user(
        username="provider_deny_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )
    case_manager = User.objects.create_user(
        username="case_mgr_deny",
        password="testpass123",
        role=User.Role.CASE_MANAGER,
        district=district,
    )
    facility = Facility.objects.create(
        provider=provider,
        name="Deny House",
        address="700 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )
    bed = Bed.objects.create(facility=facility, label="Bed Deny", status=Bed.Status.HELD)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-15001",
        first_name="Taylor",
        last_name="Morgan",
        district=district,
    )
    hold = Hold.objects.create(
        bed=bed,
        parolee=parolee,
        placed_by=case_manager,
        reason="Testing denial",
        expires_at=timezone.now() + timedelta(hours=48),
    )

    client.force_login(provider_user)
    resp = client.post(f"/api/provider/holds/{hold.id}/deny/", data={}, content_type="application/json")

    assert resp.status_code == 200
    bed.refresh_from_db()
    hold.refresh_from_db()
    assert bed.status == Bed.Status.AVAILABLE
    assert hold.status == Hold.Status.CANCELLED


@pytest.mark.django_db
def test_provider_can_update_end_date_and_release_early(client):
    district = District.objects.create(number=16, name="End Date District")
    provider = Provider.objects.create(name="Provider End Date")

    provider_user = User.objects.create_user(
        username="provider_end_date_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="End Date House",
        address="800 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )
    bed = Bed.objects.create(facility=facility, label="Bed End Date", status=Bed.Status.OCCUPIED)
    parolee = Parolee.objects.create(
        idoc_id="IDOC-16001",
        first_name="Casey",
        last_name="Reed",
        district=district,
        assigned_bed=bed,
        housing_start_date=timezone.now().date() - timedelta(days=2),
        housing_end_date=timezone.now().date() + timedelta(days=10),
    )

    client.force_login(provider_user)
    resp = client.patch(
        f"/api/provider/placements/{parolee.id}/end-date/",
        data={"housing_end_date": str(timezone.now().date() - timedelta(days=1))},
        content_type="application/json",
    )

    assert resp.status_code == 200
    bed.refresh_from_db()
    parolee.refresh_from_db()
    assert bed.status == Bed.Status.AVAILABLE
    assert parolee.assigned_bed is None
    assert parolee.housing_end_date == timezone.now().date() - timedelta(days=1)


@pytest.mark.django_db
def test_provider_can_create_client_record(client):
    district = District.objects.create(number=17, name="Client Intake District")
    provider = Provider.objects.create(name="Provider Client Intake")

    provider_user = User.objects.create_user(
        username="provider_client_intake_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="Client Intake House",
        address="900 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.BASIC,
    )

    client.force_login(provider_user)
    resp = client.post(
        "/api/provider/clients/",
        data={
            "first_name": "Jamie",
            "last_name": "Wells",
            "idoc_id": "IDOC-17001",
        },
        content_type="application/json",
    )

    assert resp.status_code == 201
    body = resp.json()
    parolee = Parolee.objects.get(pk=body["id"])
    assert parolee.first_name == "Jamie"
    assert parolee.last_name == "Wells"
    assert parolee.idoc_id == "IDOC-17001"
    assert parolee.district_id == facility.district_id


@pytest.mark.django_db
def test_provider_can_place_anonymous_hold(client):
    district = District.objects.create(number=18, name="Anonymous Hold District")
    provider = Provider.objects.create(name="Provider Anonymous Hold")

    provider_user = User.objects.create_user(
        username="provider_anonymous_hold_user",
        password="testpass123",
        role=User.Role.PROVIDER,
        provider=provider,
    )

    facility = Facility.objects.create(
        provider=provider,
        name="Anonymous Hold House",
        address="1000 Main St",
        city="Boise",
        state="ID",
        zip_code="83701",
        district=district,
        track=Facility.Track.PLUS,
    )
    bed = Bed.objects.create(facility=facility, label="Bed 1")

    client.force_login(provider_user)
    resp = client.post(
        "/api/provider/holds/",
        data={
            "bed_id": bed.id,
            "reason": "Temporary anonymous reservation",
        },
        content_type="application/json",
    )

    assert resp.status_code == 201
    body = resp.json()
    hold = Hold.objects.get(pk=body["hold"]["hold_id"])
    bed.refresh_from_db()
    hold.refresh_from_db()
    assert hold.status == Hold.Status.ACTIVE
    assert hold.parolee.first_name == "Anonymous"
    assert hold.parolee.last_name == "Hold"
    assert hold.parolee.idoc_id.startswith("ANON-")
    assert hold.reason == "Temporary anonymous reservation"
    assert bed.status == Bed.Status.AVAILABLE
    assert body["hold"]["hold_client_name"] == "Anonymous hold"
