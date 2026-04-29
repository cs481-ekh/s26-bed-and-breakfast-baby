import pytest
from django.utils import timezone
from datetime import timedelta

from housing.models import Invite, Provider, User, District


@pytest.mark.django_db
def test_admin_can_create_provider(client):
    admin_user = User.objects.create_user(
        username="admin_provider_create",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    client.force_login(admin_user)

    district = District.objects.create(number=1, name="First District")
    response = client.post(
        "/api/admin/providers/create/",
        {
            "name": "North Star Housing",
            "contact_name": "Casey Smith",
            "contact_email": "casey@northstar.org",
            "contact_phone": "208-555-0101",
            "district_id": district.id,
            "address": "123 Main St",
            "notes": "Some provider notes",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["provider"]["provider_name"] == "North Star Housing"
    assert Provider.objects.filter(name="North Star Housing").exists()


@pytest.mark.django_db
def test_admin_provider_invite_requires_provider_id(client):
    admin_user = User.objects.create_user(
        username="admin_provider_invite",
        password="testpass123",
        role=User.Role.ADMIN,
    )
    client.force_login(admin_user)

    response = client.post(
        "/api/users/create-invite/",
        {
            "email": "staff@provider.org",
            "role": "provider",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "provider_id is required" in response.json()["error"]


@pytest.mark.django_db
def test_signup_with_provider_invite_skips_employee_id_and_links_provider(client):
    provider = Provider.objects.create(name="Linked Provider")
    invite = Invite.objects.create(
        email="new.provider@housing.org",
        role=User.Role.PROVIDER,
        token="provider-token-1",
        provider=provider,
        expires_at=timezone.now() + timedelta(days=2),
    )

    response = client.post(
        "/api/signup-with-invite/",
        {
            "token": invite.token,
            "first_name": "Robin",
            "last_name": "Provider",
            "password": "StrongPassword123!",
            "confirm_password": "StrongPassword123!",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    created = User.objects.get(username="new.provider@housing.org")
    assert created.role == User.Role.PROVIDER
    assert created.provider_id == provider.id
