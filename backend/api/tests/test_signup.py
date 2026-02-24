import pytest
from django.contrib.auth import get_user_model


User = get_user_model()


@pytest.mark.django_db
def test_signup_creates_user(client):
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "employee_id": "E12345",
        "email": "jane.doe@example.com",
        "password": "StrongPassword123!",
        "confirm_password": "StrongPassword123!",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "jane.doe@example.com"
    assert body["employee_id"] == "E12345"
    assert body["first_name"] == "Jane"
    assert body["last_name"] == "Doe"
    assert body["redirect_to"] == "/"

    user = User.objects.get(username="jane.doe@example.com")
    assert user.first_name == "Jane"
    assert user.last_name == "Doe"
    assert user.email == "jane.doe@example.com"
    assert user.password != "StrongPassword123!"
    assert user.check_password("StrongPassword123!")


@pytest.mark.django_db
def test_signup_rejects_password_mismatch(client):
    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "employee_id": "E12345",
        "email": "jane.doe@example.com",
        "password": "StrongPassword123!",
        "confirm_password": "DifferentPassword123!",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 400
    assert "do not match" in resp.json()["errors"]["confirm_password"]


@pytest.mark.django_db
def test_signup_rejects_duplicate_email(client):
    User.objects.create_user(
        username="jane.doe@example.com",
        email="jane.doe@example.com",
        password="Password123!",
        first_name="Existing",
        last_name="User"
    )

    payload = {
        "first_name": "Jane",
        "last_name": "Doe",
        "employee_id": "E12345",
        "email": "jane.doe@example.com",
        "password": "StrongPassword123!",
        "confirm_password": "StrongPassword123!",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 400
    assert "already exists" in resp.json()["errors"]["email"]


@pytest.mark.django_db
def test_signup_returns_required_field_errors(client):
    payload = {
        "first_name": "",
        "last_name": "",
        "employee_id": "",
        "email": "",
        "password": "",
        "confirm_password": "",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 400
    errors = resp.json()["errors"]
    assert "first_name" in errors
    assert "last_name" in errors
    assert "employee_id" in errors
    assert "email" in errors
    assert "password" in errors
    assert "confirm_password" in errors