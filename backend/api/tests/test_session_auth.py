import pytest

from housing.models import User


@pytest.mark.django_db
def test_login_creates_authenticated_session(client):
    user = User.objects.create_user(
        username="admin_seed",
        password="testpass123",
        role=User.Role.ADMIN,
    )

    login_resp = client.post(
        "/api/auth/login/",
        {"username": user.username, "password": "testpass123"},
        content_type="application/json",
    )

    assert login_resp.status_code == 200
    payload = login_resp.json()
    assert payload["user"]["username"] == "admin_seed"
    assert payload["user"]["role"] == User.Role.ADMIN

    me_resp = client.get("/api/me/")
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "admin_seed"


@pytest.mark.django_db
def test_login_rejects_invalid_credentials(client):
    User.objects.create_user(
        username="staff_user",
        password="correctpass123",
        role=User.Role.IDOC_STAFF,
    )

    resp = client.post(
        "/api/auth/login/",
        {"username": "case_mgr", "password": "wrongpass"},
        content_type="application/json",
    )

    assert resp.status_code == 401


@pytest.mark.django_db
def test_logout_clears_session(client):
    user = User.objects.create_user(
        username="staff_seed",
        password="testpass123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(user)
    logout_resp = client.post("/api/auth/logout/", {}, content_type="application/json")

    assert logout_resp.status_code == 200

    me_resp = client.get("/api/me/")
    assert me_resp.status_code == 403
