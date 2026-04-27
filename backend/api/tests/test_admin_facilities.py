import pytest

from housing.models import Bed, District, Facility, Provider, User


@pytest.mark.django_db
def test_admin_provider_and_district_lists_require_admin_role(client):
    staff_user = User.objects.create_user(
        username="staff_facilities_read",
        password="testpass123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(staff_user)

    providers_response = client.get("/api/admin/providers/")
    districts_response = client.get("/api/admin/districts/")

    assert providers_response.status_code == 403
    assert districts_response.status_code == 403


@pytest.mark.django_db
def test_admin_provider_and_district_lists_return_data_for_admin(client):
    admin_user = User.objects.create_user(
        username="admin_facilities_read",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider North")
    district = District.objects.create(number=1, name="First")

    client.force_login(admin_user)

    providers_response = client.get("/api/admin/providers/")
    districts_response = client.get("/api/admin/districts/")

    assert providers_response.status_code == 200
    assert districts_response.status_code == 200

    providers_payload = providers_response.json()
    districts_payload = districts_response.json()

    assert any(entry["provider_id"] == provider.id for entry in providers_payload)
    assert any(entry["district_id"] == district.id for entry in districts_payload)


@pytest.mark.django_db
def test_admin_can_create_facility(client):
    admin_user = User.objects.create_user(
        username="admin_facility_create",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider A")
    district = District.objects.create(number=2, name="Second")

    client.force_login(admin_user)
    response = client.post(
        "/api/admin/facilities/create/",
        {
            "provider_id": provider.id,
            "district_id": district.id,
            "name": "Maple House",
            "address": "123 Main St",
            "city": "Boise",
            "state": "ID",
            "zip_code": "83701",
            "track": "basic",
            "accepts_male": True,
            "accepts_female": False,
            "accepts_sex_offender": False,
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["facility"]["facility_name"] == "Maple House"

    created = Facility.objects.get(name="Maple House")
    assert created.provider_id == provider.id
    assert created.district_id == district.id


@pytest.mark.django_db
def test_admin_facility_remove_requires_no_assigned_clients(client):
    admin_user = User.objects.create_user(
        username="admin_facility_remove_guard",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider B")
    district = District.objects.create(number=3, name="Third")
    facility = Facility.objects.create(
        provider=provider,
        district=district,
        name="River House",
        city="Nampa",
        state="ID",
        zip_code="83651",
        track=Facility.Track.BASIC,
    )
    assigned_bed = Bed.objects.create(facility=facility, label="Bed 1", status=Bed.Status.OCCUPIED)
    from housing.models import Parolee

    district_client = District.objects.create(number=4, name="Fourth")
    Parolee.objects.create(
        idoc_id="IDOC-FAC-409",
        first_name="Assigned",
        last_name="Client",
        district=district_client,
        assigned_bed=assigned_bed,
    )

    client.force_login(admin_user)
    response = client.post(f"/api/admin/facilities/{facility.id}/remove/", {}, content_type="application/json")

    assert response.status_code == 409
    facility.refresh_from_db()
    assert facility.is_active is True


@pytest.mark.django_db
def test_admin_can_soft_remove_unassigned_facility(client):
    admin_user = User.objects.create_user(
        username="admin_facility_remove_ok",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider C")
    district = District.objects.create(number=5, name="Fifth")
    facility = Facility.objects.create(
        provider=provider,
        district=district,
        name="Cedar House",
        city="Meridian",
        state="ID",
        zip_code="83642",
        track=Facility.Track.PLUS,
    )

    client.force_login(admin_user)
    response = client.post(f"/api/admin/facilities/{facility.id}/remove/", {}, content_type="application/json")

    assert response.status_code == 200
    facility.refresh_from_db()
    assert facility.is_active is False


@pytest.mark.django_db
def test_admin_can_hard_delete_unassigned_facility(client):
    admin_user = User.objects.create_user(
        username="admin_facility_hard_remove_ok",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider D")
    district = District.objects.create(number=6, name="Sixth")
    facility = Facility.objects.create(
        provider=provider,
        district=district,
        name="Aspen House",
        city="Boise",
        state="ID",
        zip_code="83702",
        track=Facility.Track.HOTEL,
    )

    client.force_login(admin_user)
    response = client.post(
        f"/api/admin/facilities/{facility.id}/remove/",
        {"deletion_type": "hard"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert not Facility.objects.filter(pk=facility.id).exists()


@pytest.mark.django_db
def test_admin_facility_remove_rejects_invalid_deletion_type(client):
    admin_user = User.objects.create_user(
        username="admin_facility_bad_delete_type",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider E")
    district = District.objects.create(number=7, name="Seventh")
    facility = Facility.objects.create(
        provider=provider,
        district=district,
        name="Pine House",
        city="Idaho Falls",
        state="ID",
        zip_code="83401",
        track=Facility.Track.BASIC,
    )

    client.force_login(admin_user)
    response = client.post(
        f"/api/admin/facilities/{facility.id}/remove/",
        {"deletion_type": "archive"},
        content_type="application/json",
    )

    assert response.status_code == 400
    facility.refresh_from_db()
    assert facility.is_active is True


@pytest.mark.django_db
def test_admin_can_toggle_facility_active_state(client):
    admin_user = User.objects.create_user(
        username="admin_facility_toggle",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    provider = Provider.objects.create(name="Provider F")
    district = District.objects.create(number=8, name="Eighth")
    facility = Facility.objects.create(
        provider=provider,
        district=district,
        name="Spruce House",
        city="Boise",
        state="ID",
        zip_code="83703",
        track=Facility.Track.BASIC,
        is_active=True,
    )

    client.force_login(admin_user)

    deactivate_response = client.post(f"/api/admin/facilities/{facility.id}/toggle-active/", {}, content_type="application/json")
    assert deactivate_response.status_code == 200
    facility.refresh_from_db()
    assert facility.is_active is False

    reactivate_response = client.post(f"/api/admin/facilities/{facility.id}/toggle-active/", {}, content_type="application/json")
    assert reactivate_response.status_code == 200
    facility.refresh_from_db()
    assert facility.is_active is True
