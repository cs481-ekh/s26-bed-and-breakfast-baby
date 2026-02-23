import pytest
from django.contrib.auth import get_user_model


User = get_user_model()


@pytest.mark.django_db
def test_signup_creates_user(client):
    payload = {
        "name": "Jane Doe",
        "employee_id": "E12345",
        "password": "StrongPassword123!",
        "confirm_password": "StrongPassword123!",
        "role": "user",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "E12345"
    assert body["name"] == "Jane Doe"
    assert body["is_staff"] is False
    assert body["redirect_to"] == "/"

    user = User.objects.get(username="E12345")
    assert user.first_name == "Jane Doe"
    assert user.password != "StrongPassword123!"
    assert user.check_password("StrongPassword123!")


@pytest.mark.django_db
def test_signup_rejects_password_mismatch(client):
    payload = {
        "name": "Jane Doe",
        "employee_id": "E12345",
        "password": "StrongPassword123!",
        "confirm_password": "WrongPassword123!",
        "role": "user",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 400
    assert "Passwords do not match" in resp.json()["errors"]["confirm_password"]


@pytest.mark.django_db
def test_signup_rejects_duplicate_employee_id(client):
    User.objects.create_user(username="E12345", password="Password123!", first_name="Existing")

    payload = {
        "name": "Jane Doe",
        "employee_id": "E12345",
        "password": "StrongPassword123!",
        "confirm_password": "StrongPassword123!",
        "role": "user",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 400
    assert "already exists" in resp.json()["errors"]["employee_id"]


@pytest.mark.django_db
def test_signup_returns_required_field_errors(client):
    payload = {
        "name": "",
        "employee_id": "",
        "password": "",
        "confirm_password": "",
        "role": "user",
    }

    resp = client.post("/api/signup/", data=payload, content_type="application/json")

    assert resp.status_code == 400
    errors = resp.json()["errors"]
    assert "name" in errors
    assert "employee_id" in errors
    assert "password" in errors
    assert "confirm_password" in errors