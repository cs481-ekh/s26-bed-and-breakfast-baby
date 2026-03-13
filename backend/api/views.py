from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.decorators import action
from housing.models import Facility, User
from .serializers import UserSerializer


User = get_user_model()

class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class FacilityAvailabilityView(APIView):
    def get(self, request):
        include_inactive = str(
            request.query_params.get("include_inactive", "false")
        ).lower() in {"1", "true", "yes"}

        facility_queryset = Facility.objects.all() if include_inactive else Facility.objects.filter(is_active=True)

        facilities = (
            facility_queryset.select_related("provider", "district")
            .annotate(
                total_beds=Count("beds", distinct=True),
                assigned_beds=Count(
                    "beds",
                    filter=Q(beds__assigned_parolee__isnull=False),
                    distinct=True,
                ),
            )
            .order_by("provider__name", "name")
        )

        data = []
        for facility in facilities:
            available_beds = max(facility.total_beds - facility.assigned_beds, 0)
            data.append(
                {
                    "facility_id": facility.id,
                    "facility_name": facility.name,
                    "provider_name": facility.provider.name,
                    "district_number": facility.district.number,
                    "district_name": facility.district.name,
                    "tier": facility.tier,
                    "is_active": facility.is_active,
                    "total_beds": facility.total_beds,
                    "assigned_beds": facility.assigned_beds,
                    "available_beds": available_beds,
                }
            )

        return Response(data)


class SignUpView(APIView):
    def post(self, request):
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        employee_id = (request.data.get("employee_id") or "").strip()
        email = (request.data.get("email") or "").strip()
        role = (request.data.get("role") or User.Role.CASE_MANAGER).strip()
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
        valid_roles = {choice[0] for choice in User.Role.choices}
        if role not in valid_roles:
            errors["role"] = "Role must be admin, case_manager, or provider."
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
            role=role,
        )

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "employee_id": employee_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "redirect_to": "/",
            },
            status=status.HTTP_201_CREATED,
        )
class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing users.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_queryset(self):
        return User.objects.all().order_by('-date_joined')

    @action(detail=False, methods=['post'], url_path='update-role')
    def update_role(self, request):
        """
        Update a user's role by username.
        Expects: {"username": "user@example.com", "role": "admin|case_manager|provider"}
        """
        username = (request.data.get('username') or '').strip()
        role = (request.data.get('role') or '').strip()

        if not username:
            return Response(
                {"error": "Username is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_roles = {choice[0] for choice in User.Role.choices}
        if role not in valid_roles:
            return Response(
                {"error": "Invalid role. Use admin, case_manager, or provider."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username=username)

            # Safety guard: an active admin cannot demote their own account.
            if (
                request.user.is_authenticated
                and request.user.pk == user.pk
                and getattr(request.user, "role", None) == User.Role.ADMIN
                and request.user.is_active
                and role != User.Role.ADMIN
            ):
                return Response(
                    {"error": "Active admins cannot demote their own account."},
                    status=status.HTTP_403_FORBIDDEN
                )

            user.role = role
            user.save(update_fields=['role'])

            return Response(
                {
                    "message": f"User {username} role updated to {role}.",
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {"error": f"User {username} not found."},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'], url_path='disable')
    def disable_user(self, request):
        """
        Disable a user account by setting is_active to False.
        Expects: {"username": "user@example.com"}
        """
        username = request.data.get('username')
        
        if not username:
            return Response(
                {"error": "Username is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(username=username)
            user.is_active = False
            user.save()
            
            return Response(
                {
                    "message": f"User {username} has been disabled.",
                    "user": UserSerializer(user).data
                },
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {"error": f"User {username} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='remove')
    def remove_user(self, request):
        """
        Remove a user account from the database by username.
        Expects: {"username": "user@example.com"}
        """
        username = (request.data.get('username') or '').strip()

        if not username:
            return Response(
                {"error": "Username is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username=username)

            # Safety guard: do not allow an admin to delete their own active account.
            if (
                request.user.is_authenticated
                and request.user.pk == user.pk
                and getattr(request.user, "role", None) == User.Role.ADMIN
                and request.user.is_active
            ):
                return Response(
                    {"error": "Admins cannot delete their own active account."},
                    status=status.HTTP_403_FORBIDDEN
                )

            user.delete()

            return Response(
                {"message": f"User {username} has been removed."},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {"error": f"User {username} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

