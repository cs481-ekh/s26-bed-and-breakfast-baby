from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView


User = get_user_model()

class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class SignUpView(APIView):
    def post(self, request):
        name = (request.data.get("name") or "").strip()
        employee_id = (request.data.get("employee_id") or "").strip()
        password = request.data.get("password") or ""
        confirm_password = request.data.get("confirm_password") or ""

        errors = {}
        if not name:
            errors["name"] = "Name is required."
        if not employee_id:
            errors["employee_id"] = "Employee ID is required."
        if not password:
            errors["password"] = "Password is required."
        if not confirm_password:
            errors["confirm_password"] = "Please confirm your password."

        if password and confirm_password and password != confirm_password:
            errors["confirm_password"] = "Passwords do not match."

        if employee_id and User.objects.filter(username=employee_id).exists():
            errors["employee_id"] = "A user with this employee ID already exists."

        if password:
            try:
                validate_password(password)
            except ValidationError as exc:
                errors["password"] = " ".join(exc.messages)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        role = request.data.get("role")
        is_staff = role == "admin"

        user = User.objects.create_user(
            username=employee_id,
            first_name=name,
            password=password,
            is_staff=is_staff,
        )

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "name": user.first_name,
                "is_staff": user.is_staff,
                "redirect_to": "/",
            },
            status=status.HTTP_201_CREATED,
        )

