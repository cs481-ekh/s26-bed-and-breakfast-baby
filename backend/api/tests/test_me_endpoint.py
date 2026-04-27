import pytest

from housing.models import User


@pytest.mark.django_db
def test_me_endpoint_requires_authentication(client):
    resp = client.get("/api/me/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_me_endpoint_returns_current_user_role(client):
    user = User.objects.create_user(
        username="staff_user",
        password="testpass123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(user)
    resp = client.get("/api/me/")

    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "staff_user"
    assert body["role"] == "idoc_staff"
