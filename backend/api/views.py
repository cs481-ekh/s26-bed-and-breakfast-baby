from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
import re
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from housing.models import Facility, User, Bed, Parolee, Hold
from .serializers import UserSerializer, BedSerializer, ParoleeSerializer


User = get_user_model()


def _bed_sort_key(bed):
    label = (bed.label or '').strip()
    is_sex_offender_bed = 0 if getattr(bed, 'is_sex_offender_bed', False) else 1
    match = re.search(r'(\d+)$', label)
    bed_number = int(match.group(1)) if match else float('inf')
    return (is_sex_offender_bed, bed_number, label.lower(), bed.id)


# Lightweight health check used by containers and uptime monitors.
class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


# Facility rollup endpoint for dashboard table totals.
class FacilityAvailabilityView(APIView):
    def get(self, request):
        include_inactive = str(
            request.query_params.get("include_inactive", "false")
        ).lower() in {"1", "true", "yes"}
        district_numbers = [value.strip() for value in request.query_params.getlist("district") if value.strip()]
        gender_targets = {
            value.strip().lower()
            for value in request.query_params.getlist("gender")
            if value.strip()
        }
        so_bed_targets = {
            value.strip().lower()
            for value in request.query_params.getlist("so_beds")
            if value.strip()
        }
        sex_offender = (request.query_params.get("sex_offender") or "").strip().lower()

        facility_queryset = Facility.objects.all() if include_inactive else Facility.objects.filter(is_active=True)

        if district_numbers:
            facility_queryset = facility_queryset.filter(district__number__in=district_numbers)

        gender_query = Q()
        if "male" in gender_targets:
            gender_query |= Q(accepts_male=True, accepts_female=False)
        if "female" in gender_targets:
            gender_query |= Q(accepts_female=True, accepts_male=False)
        if "either" in gender_targets:
            gender_query |= Q(accepts_male=True, accepts_female=True)

        if gender_targets:
            facility_queryset = facility_queryset.filter(gender_query)

        so_bed_query = Q()
        if "has" in so_bed_targets:
            so_bed_query |= Q(beds__is_sex_offender_bed=True)
        if "none" in so_bed_targets:
            so_bed_query |= ~Q(beds__is_sex_offender_bed=True)

        if so_bed_targets:
            facility_queryset = facility_queryset.filter(so_bed_query)

        if sex_offender in {"1", "true", "yes"}:
            facility_queryset = facility_queryset.filter(accepts_sex_offender=True)

        # Aggregate on related beds so frontend does not need to compute totals.
        facilities = (
            facility_queryset.select_related("provider", "district")
            .annotate(
                total_beds=Count("beds", distinct=True),
                assigned_beds=Count(
                    "beds",
                    filter=Q(beds__assigned_parolee__isnull=False),
                    distinct=True,
                ),
                sex_offender_bed_count=Count(
                    "beds",
                    filter=Q(beds__is_sex_offender_bed=True),
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
                    "accepts_male": facility.accepts_male,
                    "accepts_female": facility.accepts_female,
                    "accepts_sex_offender": facility.accepts_sex_offender,
                    "has_sex_offender_beds": facility.sex_offender_bed_count > 0,
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

        # Collect all validation errors in one response for better form UX.
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
            errors["role"] = "Role must be admin, case_manager, parole_officer, or provider."
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
        Expects: {"username": "user@example.com", "role": "admin|case_manager|parole_officer|provider"}
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
                {"error": "Invalid role. Use admin, case_manager, parole_officer, or provider."},
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


class FacilityBedsView(APIView):
    """Return all beds for a given facility."""

    def get(self, request, facility_id):
        try:
            facility = Facility.objects.get(pk=facility_id)
        except Facility.DoesNotExist:
            return Response({"error": "Facility not found."}, status=status.HTTP_404_NOT_FOUND)

        # Pass request context so serializer can expose role-specific fields.
        beds = sorted(
            Bed.objects.filter(facility=facility).select_related("facility"),
            key=_bed_sort_key,
        )
        return Response(BedSerializer(beds, many=True, context={"request": request}).data)


class ParoleeListView(APIView):
    """Return parolees that have no current bed assignment."""

    def get(self, request):
        parolees = Parolee.objects.filter(assigned_bed__isnull=True).order_by("last_name", "first_name")
        return Response(ParoleeSerializer(parolees, many=True).data)


class BedAssignView(APIView):
    """Assign an unassigned parolee to an available bed."""

    def post(self, request, bed_id):
        parolee_id = request.data.get("parolee_id")
        if not parolee_id:
            return Response({"error": "parolee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bed = Bed.objects.get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({"error": "Bed not found."}, status=status.HTTP_404_NOT_FOUND)

        if bed.status != Bed.Status.AVAILABLE:
            return Response({"error": "Bed is not available."}, status=status.HTTP_409_CONFLICT)

        try:
            parolee = Parolee.objects.get(pk=parolee_id)
        except Parolee.DoesNotExist:
            return Response({"error": "Parolee not found."}, status=status.HTTP_404_NOT_FOUND)

        if parolee.assigned_bed is not None:
            return Response({"error": "Parolee already has a bed assignment."}, status=status.HTTP_409_CONFLICT)

        # Append a note history line for auditing assignment activity.
        request_user = request.user if request.user.is_authenticated else None
        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
        assignment_note = (
            f"[{event_time}] Assigned to {parolee.last_name}, {parolee.first_name} "
            f"({parolee.idoc_id})."
        )
        bed.notes = f"{bed.notes}\n{assignment_note}".strip() if bed.notes else assignment_note
        bed.status = Bed.Status.OCCUPIED
        bed.updated_by = request_user
        bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

        parolee.assigned_bed = bed
        parolee.housing_start_date = timezone.now().date()
        parolee.save(update_fields=["assigned_bed", "housing_start_date"])

        return Response(
            {"message": f"Bed '{bed.label}' assigned to {parolee.last_name}, {parolee.first_name}."},
            status=status.HTTP_200_OK,
        )


class BedHoldRequestView(APIView):
    """Place a temporary hold on an available bed for testing workflows."""

    def post(self, request, bed_id):
        request_user = request.user if request.user.is_authenticated else None
        if request_user is None or getattr(request_user, "role", None) not in {User.Role.ADMIN, User.Role.CASE_MANAGER}:
            return Response(
                {"error": "Only case managers and admins can request holds."},
                status=status.HTTP_403_FORBIDDEN,
            )

        parolee_id = request.data.get("parolee_id")
        if not parolee_id:
            return Response({"error": "parolee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bed = Bed.objects.get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({"error": "Bed not found."}, status=status.HTTP_404_NOT_FOUND)

        if bed.status != Bed.Status.AVAILABLE:
            return Response({"error": "Only available beds can be held."}, status=status.HTTP_409_CONFLICT)

        try:
            parolee = Parolee.objects.get(pk=parolee_id)
        except Parolee.DoesNotExist:
            return Response({"error": "Parolee not found."}, status=status.HTTP_404_NOT_FOUND)

        if parolee.assigned_bed is not None:
            return Response({"error": "Parolee already has a bed assignment."}, status=status.HTTP_409_CONFLICT)

        # Prevent duplicate active holds for the same bed/parolee pair.
        if Hold.objects.filter(bed=bed, parolee=parolee, status=Hold.Status.ACTIVE).exists():
            return Response({"error": "This bed already has an active hold for the selected parolee."}, status=status.HTTP_409_CONFLICT)

        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
        hold_note = (
            f"[{event_time}] Hold requested for {parolee.last_name}, {parolee.first_name} "
            f"({parolee.idoc_id}) pending facility approval."
        )

        # Create hold record first, then sync bed status for dashboard visibility.
        Hold.objects.create(
            bed=bed,
            parolee=parolee,
            placed_by=request_user,
            reason="Testing hold request from main dashboard",
            expires_at=timezone.now() + timedelta(hours=48),
        )

        bed.notes = f"{bed.notes}\n{hold_note}".strip() if bed.notes else hold_note
        bed.status = Bed.Status.HELD
        bed.updated_by = request_user
        bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

        return Response(
            {"message": f"Hold requested on bed '{bed.label}'."},
            status=status.HTTP_200_OK,
        )


class BedUnassignView(APIView):
    """Clear assignment for a single bed and mark it available."""

    def post(self, request, bed_id):
        try:
            bed = Bed.objects.get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({"error": "Bed not found."}, status=status.HTTP_404_NOT_FOUND)

        if bed.status == Bed.Status.HELD:
            request_user = request.user if request.user.is_authenticated else None
            event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
            release_note = f"[{event_time}] Hold removed."

            # Releasing a hold should retire active hold records for that bed.
            Hold.objects.filter(bed=bed, status=Hold.Status.ACTIVE).update(status=Hold.Status.CANCELLED)

            bed.notes = f"{bed.notes}\n{release_note}".strip() if bed.notes else release_note
            bed.status = Bed.Status.AVAILABLE
            bed.updated_by = request_user
            bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

            return Response(
                {"message": f"Released hold on bed '{bed.label}'."},
                status=status.HTTP_200_OK,
            )

        try:
            parolee = Parolee.objects.get(assigned_bed=bed)
        except Parolee.DoesNotExist:
            return Response({"error": "Bed has no current assignment or hold."}, status=status.HTTP_409_CONFLICT)

        # Keep parolee and bed updates atomic so they cannot drift apart.
        with transaction.atomic():
            parolee.assigned_bed = None
            parolee.housing_start_date = None
            parolee.housing_end_date = None
            parolee.save(update_fields=["assigned_bed", "housing_start_date", "housing_end_date"])

            request_user = request.user if request.user.is_authenticated else None
            event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
            unassignment_note = (
                f"[{event_time}] Unassigned {parolee.last_name}, {parolee.first_name} "
                f"({parolee.idoc_id})."
            )
            bed.notes = f"{bed.notes}\n{unassignment_note}".strip() if bed.notes else unassignment_note
            bed.status = Bed.Status.AVAILABLE
            bed.updated_by = request_user
            bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

        return Response(
            {
                "message": f"Unassigned {parolee.last_name}, {parolee.first_name} from bed '{bed.label}'."
            },
            status=status.HTTP_200_OK,
        )


class BedNotesUpdateView(APIView):
    """Create or update notes for a bed (admin only)."""

    def patch(self, request, bed_id):
        request_user = request.user if request.user.is_authenticated else None
        if request_user is None or getattr(request_user, "role", None) != User.Role.ADMIN:
            return Response({"error": "Only admins can edit bed notes."}, status=status.HTTP_403_FORBIDDEN)

        try:
            bed = Bed.objects.get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({"error": "Bed not found."}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get("notes")
        if notes is None:
            return Response({"error": "notes is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(notes, str):
            return Response({"error": "notes must be a string."}, status=status.HTTP_400_BAD_REQUEST)

        bed.notes = notes.strip()
        bed.updated_by = request_user
        bed.save(update_fields=["notes", "updated_by", "updated_at"])

        return Response(
            {
                "message": f"Notes updated for bed '{bed.label}'.",
                "bed": BedSerializer(bed, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "provider_id": user.provider_id,
                "district_id": user.district_id,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfCookieView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set."}, status=status.HTTP_200_OK)


class SessionLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        password = request.data.get("password") or ""

        if not identifier or not password:
            return Response(
                {"error": "username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = identifier
        if "@" in identifier:
            matched_user = User.objects.filter(email__iexact=identifier).first()
            if matched_user is not None:
                username = matched_user.username

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"error": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"error": "This account is disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)
        return Response(
            {
                "message": "Login successful.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role,
                    "provider_id": user.provider_id,
                    "district_id": user.district_id,
                },
            },
            status=status.HTTP_200_OK,
        )


class SessionLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({"message": "Logout successful."}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password") or ""
        new_password = request.data.get("new_password") or ""
        confirm_new_password = request.data.get("confirm_new_password") or ""

        errors = {}
        if not current_password:
            errors["current_password"] = "Current password is required."
        if not new_password:
            errors["new_password"] = "New password is required."
        if not confirm_new_password:
            errors["confirm_new_password"] = "Please confirm your new password."

        if new_password and confirm_new_password and new_password != confirm_new_password:
            errors["confirm_new_password"] = "New passwords do not match."

        if current_password and new_password and current_password == new_password:
            errors["new_password"] = "New password must be different from current password."

        if current_password and not request.user.check_password(current_password):
            errors["current_password"] = "Current password is incorrect."

        if new_password:
            try:
                validate_password(new_password, user=request.user)
            except ValidationError as exc:
                errors["new_password"] = " ".join(exc.messages)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])

        # Keep this browser session valid while invalidating sessions tied to the old auth hash.
        update_session_auth_hash(request, request.user)

        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)


class ProviderBedsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", None) != User.Role.PROVIDER:
            return Response({"error": "Only housing providers can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        if not request.user.provider_id:
            return Response({"error": "Provider account is not linked to a provider record."}, status=status.HTTP_400_BAD_REQUEST)

        beds = (
            Bed.objects.filter(facility__provider_id=request.user.provider_id)
            .select_related("facility", "facility__district", "assigned_parolee")
        )

        beds = sorted(beds, key=lambda bed: (bed.facility.name, *_bed_sort_key(bed)))

        data = []
        for bed in beds:
            parolee = bed.assigned_parolee
            data.append(
                {
                    "bed_id": bed.id,
                    "bed_label": bed.label,
                    "bed_status": bed.status,
                    "facility_id": bed.facility_id,
                    "facility_name": bed.facility.name,
                    "district_number": bed.facility.district.number,
                    "client_id": parolee.idoc_id if parolee else None,
                    "client_name": f"{parolee.last_name}, {parolee.first_name}" if parolee else None,
                }
            )

        return Response(data, status=status.HTTP_200_OK)


class ProviderAssignClientView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if getattr(request.user, "role", None) != User.Role.PROVIDER:
            return Response({"error": "Only housing providers can assign clients."}, status=status.HTTP_403_FORBIDDEN)

        if not request.user.provider_id:
            return Response({"error": "Provider account is not linked to a provider record."}, status=status.HTTP_400_BAD_REQUEST)

        bed_id = request.data.get("bed_id")
        idoc_id = (request.data.get("idoc_id") or "").strip()

        if not bed_id:
            return Response({"error": "bed_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not idoc_id:
            return Response({"error": "idoc_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bed = Bed.objects.select_related("facility").get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({"error": "Bed not found."}, status=status.HTTP_404_NOT_FOUND)

        if bed.facility.provider_id != request.user.provider_id:
            return Response({"error": "You can only update beds for your own facilities."}, status=status.HTTP_403_FORBIDDEN)

        try:
            parolee = Parolee.objects.get(idoc_id=idoc_id)
        except Parolee.DoesNotExist:
            return Response({"error": "No parolee exists with that client ID."}, status=status.HTTP_404_NOT_FOUND)

        if bed.status != Bed.Status.AVAILABLE:
            return Response({"error": "Selected bed is not available."}, status=status.HTTP_409_CONFLICT)

        if parolee.assigned_bed is not None:
            return Response({"error": "That client already has an assigned bed."}, status=status.HTTP_409_CONFLICT)

        bed.status = Bed.Status.OCCUPIED
        bed.save(update_fields=["status"])

        parolee.assigned_bed = bed
        parolee.housing_start_date = timezone.now().date()
        parolee.save(update_fields=["assigned_bed", "housing_start_date"])

        return Response(
            {
                "message": f"Assigned {parolee.idoc_id} to {bed.label} at {bed.facility.name}.",
                "bed_id": bed.id,
                "client_id": parolee.idoc_id,
            },
            status=status.HTTP_200_OK,
        )

