import pytest

from housing.models import User


@pytest.mark.django_db
def test_change_password_requires_auth(client):
    resp = client.post(
        "/api/auth/change-password/",
        {
            "current_password": "old-pass-123",
            "new_password": "new-pass-123",
            "confirm_new_password": "new-pass-123",
        },
        content_type="application/json",
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_change_password_updates_password_and_invalidates_old_credentials(client):
    user = User.objects.create_user(
        username="settings_user",
        password="old-pass-123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(user)

    change_resp = client.post(
        "/api/auth/change-password/",
        {
            "current_password": "old-pass-123",
            "new_password": "new-pass-456",
            "confirm_new_password": "new-pass-456",
        },
        content_type="application/json",
    )

    assert change_resp.status_code == 200

    user.refresh_from_db()
    assert user.check_password("new-pass-456")
    assert not user.check_password("old-pass-123")

    old_login_resp = client.post(
        "/api/auth/login/",
        {"username": "settings_user", "password": "old-pass-123"},
        content_type="application/json",
    )
    assert old_login_resp.status_code == 401

    new_login_resp = client.post(
        "/api/auth/login/",
        {"username": "settings_user", "password": "new-pass-456"},
        content_type="application/json",
    )
    assert new_login_resp.status_code == 200


@pytest.mark.django_db
def test_change_password_rejects_wrong_current_password(client):
    user = User.objects.create_user(
        username="settings_user2",
        password="old-pass-123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(user)

    resp = client.post(
        "/api/auth/change-password/",
        {
            "current_password": "wrong-old-pass",
            "new_password": "new-pass-456",
            "confirm_new_password": "new-pass-456",
        },
        content_type="application/json",
    )

    assert resp.status_code == 400
    assert "incorrect" in resp.json()["errors"]["current_password"].lower()


@pytest.mark.django_db
def test_change_password_rejects_mismatch_confirmation(client):
    user = User.objects.create_user(
        username="settings_user3",
        password="old-pass-123",
        role=User.Role.IDOC_STAFF,
    )

    client.force_login(user)

    resp = client.post(
        "/api/auth/change-password/",
        {
            "current_password": "old-pass-123",
            "new_password": "new-pass-456",
            "confirm_new_password": "new-pass-789",
        },
        content_type="application/json",
    )

    assert resp.status_code == 400
    assert "match" in resp.json()["errors"]["confirm_new_password"].lower()
