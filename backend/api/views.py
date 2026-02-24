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
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        employee_id = (request.data.get("employee_id") or "").strip()
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password") or ""
        confirm_password = request.data.get("confirm_password") or ""

        errors = {}
        if not first_name:
            errors["first_name"] = "First name is required."
        if not last_name:
            errors["last_name"] = "Last name is required."
        if not employee_id:
            errors["employee_id"] = "Employee ID is required."
        if not email:
            errors["email"] = "Email is required."
        if not password:
            errors["password"] = "Password is required."
        if not confirm_password:
            errors["confirm_password"] = "Please confirm your password."

        if password and confirm_password and password != confirm_password:
            errors["confirm_password"] = "Passwords do not match."

        if email and User.objects.filter(username=email).exists():
            errors["email"] = "A user with this email already exists."

        if password:
            try:
                validate_password(password)
            except ValidationError as exc:
                errors["password"] = " ".join(exc.messages)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            email=email,
        )

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "employee_id": employee_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "redirect_to": "/",
            },
            status=status.HTTP_201_CREATED,
        )

