import os
import uuid
import calendar
from urllib.parse import urlparse

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils.dateparse import parse_date
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
#need to read up on this a bit more
from rest_framework.throttling import AnonRateThrottle
from housing.models import District, Facility, Provider, User, Bed, Parolee, Hold
from .serializers import UserSerializer, BedSerializer, ParoleeSerializer, AdminClientSerializer


User = get_user_model()


# custom throttle classes for rate limiting
# sprint 5 secruity for login page
# prevent ddos and other attacks 
class LoginThrottle(AnonRateThrottle):
    """rate limit loginn attempts to 5 per minute per IP address"""
    scope = 'login'
    rate = '5/min'


class PasswordChangeThrottle(AnonRateThrottle):
    """Rate limit password changes to 3 per hour per user"""
    scope = 'password_change'
    rate = '3/hour'


def _bed_sort_key(bed):
    label = (bed.label or '').strip()
    is_sex_offender_bed = 0 if getattr(bed, 'is_sex_offender_bed', False) else 1
    match = re.search(r'(\d+)$', label)
    bed_number = int(match.group(1)) if match else float('inf')
    return (is_sex_offender_bed, bed_number, label.lower(), bed.id)


PROVIDER_PLACEMENT_DAYS = 30


def _person_name(parolee):
    return f"{parolee.last_name}, {parolee.first_name}"


def _placement_dates(start_date=None):
    housing_start_date = start_date or timezone.now().date()
    return housing_start_date, housing_start_date + timedelta(days=PROVIDER_PLACEMENT_DAYS)


def _append_bed_note(bed, note, request_user=None):
    bed.notes = f"{bed.notes}\n{note}".strip() if bed.notes else note
    bed.updated_by = request_user


def _provider_bed_payload(bed, hold=None):
    parolee = getattr(bed, "assigned_parolee", None)
    if hold is None:
        hold = getattr(bed, "active_provider_hold", None)

    return {
        "bed_id": bed.id,
        "bed_label": bed.label,
        "bed_status": bed.status,
        "bed_status_label": bed.get_status_display(),
        "facility_id": bed.facility_id,
        "facility_name": bed.facility.name,
        "district_number": bed.facility.district.number,
        "client_id": parolee.idoc_id if parolee else None,
        "parolee_id": parolee.id if parolee else None,
        "client_name": _person_name(parolee) if parolee else None,
        "housing_start_date": parolee.housing_start_date if parolee else None,
        "housing_end_date": parolee.housing_end_date if parolee else None,
        "assignment_placeholder": None if parolee else "No client assigned",
        "hold_id": hold.id if hold else None,
        "hold_status": hold.status if hold else None,
        "hold_status_label": hold.get_status_display() if hold else None,
        "hold_parolee_id": hold.parolee.id if hold else None,
        "hold_client_id": hold.parolee.idoc_id if hold else None,
        "hold_client_name": _provider_client_display_name(hold.parolee) if hold else None,
        "hold_expires_at": hold.expires_at.isoformat() if hold else None,
    }


def _provider_parolee_payload(parolee):
    assigned_bed = parolee.assigned_bed
    return {
        "id": parolee.id,
        "idoc_id": parolee.idoc_id,
        "first_name": parolee.first_name,
        "last_name": parolee.last_name,
        "full_name": _person_name(parolee),
        "district_number": parolee.district.number,
        "assigned_bed_id": assigned_bed.id if assigned_bed else None,
        "assigned_bed_label": assigned_bed.label if assigned_bed else None,
        "assigned_facility_name": assigned_bed.facility.name if assigned_bed else None,
        "housing_start_date": parolee.housing_start_date,
        "housing_end_date": parolee.housing_end_date,
    }


def _provider_client_display_name(parolee):
    if parolee is None:
        return None

    if (parolee.idoc_id or "").upper().startswith("ANON-"):
        return "Anonymous hold"

    return _person_name(parolee)


def _generate_anonymous_idoc_id():
    while True:
        idoc_id = f"ANON-{uuid.uuid4().hex[:10].upper()}"
        if not Parolee.objects.filter(idoc_id__iexact=idoc_id).exists():
            return idoc_id


def _require_provider_user(request):
    if getattr(request.user, "role", None) != User.Role.PROVIDER:
        return Response({"error": "Only housing providers can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

    if not request.user.provider_id:
        return Response({"error": "Provider account is not linked to a provider record."}, status=status.HTTP_400_BAD_REQUEST)

    return request.user.provider_id


def _require_admin_user(request):
    if not request.user.is_authenticated:
        return Response({"error": "Authentication required."}, status=status.HTTP_403_FORBIDDEN)

    if getattr(request.user, "role", None) != User.Role.ADMIN:
        return Response({"error": "Only administrators can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

    return None


def _provider_default_facility(provider_id):
    return (
        Facility.objects.filter(provider_id=provider_id)
        .select_related("district")
        .order_by("name")
        .first()
    )


def _release_expired_provider_assignments(provider_id):
    today = timezone.now().date()
    expired_parolees = (
        Parolee.objects.select_related("assigned_bed", "assigned_bed__facility")
        .filter(assigned_bed__facility__provider_id=provider_id, assigned_bed__isnull=False, housing_end_date__lt=today)
    )

    if not expired_parolees.exists():
        return

    event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
    for parolee in expired_parolees:
        bed = parolee.assigned_bed
        if bed is None:
            continue

        _append_bed_note(
            bed,
            f"[{event_time}] Placement ended on {parolee.housing_end_date} and the bed was released.",
        )
        bed.status = Bed.Status.AVAILABLE
        bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

        parolee.assigned_bed = None
        parolee.save(update_fields=["assigned_bed"])


def _assign_parolee_to_bed(bed, parolee, request_user, note_text, start_date=None, end_date=None):
    housing_start_date = start_date or timezone.now().date()
    housing_end_date = end_date or housing_start_date + timedelta(days=PROVIDER_PLACEMENT_DAYS)

    _append_bed_note(bed, note_text, request_user)
    bed.status = Bed.Status.OCCUPIED
    bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

    parolee.assigned_bed = bed
    parolee.housing_start_date = housing_start_date
    parolee.housing_end_date = housing_end_date
    parolee.save(update_fields=["assigned_bed", "housing_start_date", "housing_end_date"])

    return housing_start_date, housing_end_date


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
                    "track": facility.track,
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
        role = (request.data.get("role") or User.Role.IDOC_STAFF).strip()
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
            errors["role"] = "Role must be admin, idoc_staff, or provider."
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


class ValidateInviteView(APIView):
    """
    Validate an invitation token and return invite details.
    Used by the frontend to check if a token is valid before showing signup form.
    """
    def post(self, request):
        from housing.models import Invite
        
        token = request.data.get('token')
        
        if not token:
            return Response(
                {"error": "Token is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            invite = Invite.objects.get(token=token)
            
            if invite.is_used:
                return Response(
                    {"error": "This invite has already been used."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if invite.is_expired:
                return Response(
                    {"error": "This invite has expired."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response(
                {
                    "email": invite.email,
                    "role": invite.role,
                    "expires_at": invite.expires_at.isoformat(),
                },
                status=status.HTTP_200_OK
            )
        except Invite.DoesNotExist:
            return Response(
                {"error": "Invalid invite token."},
                status=status.HTTP_404_NOT_FOUND
            )


class SignUpWithInviteView(APIView):
    """
    Complete account creation using a valid invitation token.
    """
    def post(self, request):
        from housing.models import Invite
        
        token = request.data.get('token')
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        employee_id = (request.data.get("employee_id") or "").strip()
        password = request.data.get("password") or ""
        confirm_password = request.data.get("confirm_password") or ""

        # Validate token first
        if not token:
            return Response(
                {"error": "Token is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            invite = Invite.objects.get(token=token)
        except Invite.DoesNotExist:
            return Response(
                {"error": "Invalid invite token."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if invite.is_used:
            return Response(
                {"error": "This invite has already been used."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if invite.is_expired:
            return Response(
                {"error": "This invite has expired."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Collect all validation errors in one response for better form UX.
        errors = {}
        if not first_name:
            errors["first_name"] = "First name is required."
        if not last_name:
            errors["last_name"] = "Last name is required."
        if not employee_id:
            errors["employee_id"] = "Employee ID is required."
        if not password:
            errors["password"] = "Password is required."
        if not confirm_password:
            errors["confirm_password"] = "Please confirm your password."

        if password and confirm_password and password != confirm_password:
            errors["confirm_password"] = "Passwords do not match."

        if password:
            try:
                validate_password(password)
            except ValidationError as exc:
                errors["password"] = " ".join(exc.messages)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Create the user
        user = User.objects.create_user(
            username=invite.email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            email=invite.email,
            role=invite.role,
        )
        
        # Mark invite as used
        invite.used_at = timezone.now()
        invite.save()

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
        Expects: {"username": "user@example.com", "role": "admin|idoc_staff|provider"}
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
                {"error": "Invalid role. Use admin, idoc_staff, or provider."},
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
        username = (request.data.get('username') or '').strip()

        if not username:
            return Response(
                {"error": "Username is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username=username)

            # Safety guard: do not allow an admin to deactivate their own active account.
            if (
                request.user.is_authenticated
                and request.user.pk == user.pk
                and getattr(request.user, "role", None) == User.Role.ADMIN
                and request.user.is_active
            ):
                return Response(
                    {"error": "Admins cannot deactivate their own active account."},
                    status=status.HTTP_403_FORBIDDEN
                )

            if not user.is_active:
                return Response(
                    {
                        "message": f"User {username} is already inactive.",
                        "user": UserSerializer(user).data,
                    },
                    status=status.HTTP_200_OK
                )

            user.is_active = False
            user.save(update_fields=['is_active'])

            return Response(
                {
                    "message": f"User {username} has been deactivated.",
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_200_OK
            )

        except User.DoesNotExist:
            return Response(
                {"error": f"User {username} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='enable')
    def enable_user(self, request):
        """
        Reactivate a user account by setting is_active to True.
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

            if user.is_active:
                return Response(
                    {
                        "message": f"User {username} is already active.",
                        "user": UserSerializer(user).data,
                    },
                    status=status.HTTP_200_OK
                )

            user.is_active = True
            user.save(update_fields=['is_active'])

            return Response(
                {
                    "message": f"User {username} has been reactivated.",
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_200_OK
            )

        except User.DoesNotExist:
            return Response(
                {"error": f"User {username} not found."},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'], url_path='create-invite', permission_classes=[IsAuthenticated])
    def create_invite(self, request):
        """
        Create a secure invitation token for account creation.
        SECURITY: Only admins can create invites.
        Expects: {"email": "user@example.com", "role": "idoc_staff"}
        Returns: invite_link with token in URL fragment (not logged in server logs)
        """
        from housing.models import Invite
        import secrets
        from datetime import timedelta
        import logging
        
        logger = logging.getLogger('security')
        
        # SECURITY: Check that only admins can create invites
        if getattr(request.user, "role", None) != User.Role.ADMIN:
            logger.warning(f"Unauthorized invite creation attempt by {request.user.username}")
            return Response(
                {"error": "Only administrators can create invites."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        email = (request.data.get('email') or '').strip()
        role = (request.data.get('role') or User.Role.IDOC_STAFF).strip()
        
        if not email:
            return Response(
                {"error": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        valid_roles = {choice[0] for choice in User.Role.choices}
        if role not in valid_roles:
            return Response(
                {"error": "Invalid role specified."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already exists
        if User.objects.filter(username=email).exists():
            return Response(
                {"error": "A user with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate secure token
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=3)
        
        # Create invite
        invite = Invite.objects.create(
            email=email,
            role=role,
            token=token,
            expires_at=expires_at,
            created_by=request.user if request.user.is_authenticated else None
        )
        
        logger.info(f"Invite created for {email} with role {role} by {request.user.username}")
        
        # Build an invite link that points to the frontend signup page.
        frontend_origin = request.headers.get("Origin") or request.META.get("HTTP_REFERER")
        if frontend_origin:
            parsed = urlparse(frontend_origin)
            if parsed.scheme and parsed.netloc:
                frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
            else:
                frontend_origin = None

        if not frontend_origin:
            frontend_origin = os.environ.get("FRONTEND_URL")

        if not frontend_origin:
            frontend_origin = f"{request.scheme}://{request.get_host()}"

        frontend_origin = frontend_origin.rstrip("/")
        # SECURITY: Use URL fragment (#token=) instead of query parameter (?token=)
        # Fragments are not sent to the server and won't appear in server logs
        invite_link = f"{frontend_origin}/register#{token}"
        
        return Response(
            {
                "message": f"Invite created for {email}.",
                "invite_link": invite_link,
                "expires_at": invite.expires_at.isoformat()
            },
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['post'], url_path='enable')
    def enable_user(self, request):
        """
        Enable a user account by setting is_active to True.
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
            user.is_active = True
            user.save()
            
            return Response(
                {
                    "message": f"User {username} has been enabled.",
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


class AdminClientListView(APIView):
    """Return all clients sorted by longest time in system (admin only)."""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_403_FORBIDDEN)

        if getattr(request.user, "role", None) != User.Role.ADMIN:
            return Response({"error": "Only administrators can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        clients = (
            Parolee.objects.select_related("district", "assigned_bed", "assigned_bed__facility")
            .order_by("created_at", "id")
        )
        return Response(AdminClientSerializer(clients, many=True).data)


class AdminClientRemoveView(APIView):
    """Remove a client from the system when they are unassigned (admin only)."""

    def post(self, request, client_id):
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_403_FORBIDDEN)

        if getattr(request.user, "role", None) != User.Role.ADMIN:
            return Response({"error": "Only administrators can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)

        try:
            parolee = Parolee.objects.get(pk=client_id)
        except Parolee.DoesNotExist:
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        if parolee.assigned_bed_id is not None:
            return Response(
                {"error": "Assigned clients cannot be removed. Unassign the client first."},
                status=status.HTTP_409_CONFLICT,
            )

        client_name = f"{parolee.last_name}, {parolee.first_name}"
        client_idoc = parolee.idoc_id
        parolee.delete()

        return Response(
            {"message": f"Removed client {client_name} ({client_idoc})."},
            status=status.HTTP_200_OK,
        )


class AdminProviderListView(APIView):
    """Return providers for admin facility management."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        admin_error = _require_admin_user(request)
        if admin_error is not None:
            return admin_error

        providers = Provider.objects.order_by("name")
        return Response(
            [
                {
                    "provider_id": provider.id,
                    "provider_name": provider.name,
                    "is_active": provider.is_active,
                }
                for provider in providers
            ],
            status=status.HTTP_200_OK,
        )


class AdminDistrictListView(APIView):
    """Return districts for admin facility management."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        admin_error = _require_admin_user(request)
        if admin_error is not None:
            return admin_error

        districts = District.objects.order_by("number")
        return Response(
            [
                {
                    "district_id": district.id,
                    "district_number": district.number,
                    "district_name": district.name,
                }
                for district in districts
            ],
            status=status.HTTP_200_OK,
        )


class AdminFacilityCreateView(APIView):
    """Create a new facility linked to an existing provider (admin only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        admin_error = _require_admin_user(request)
        if admin_error is not None:
            return admin_error

        provider_id = request.data.get("provider_id")
        district_id = request.data.get("district_id")
        name = (request.data.get("name") or "").strip()
        address = (request.data.get("address") or "").strip()
        city = (request.data.get("city") or "").strip()
        state = (request.data.get("state") or "ID").strip().upper()[:2] or "ID"
        zip_code = (request.data.get("zip_code") or "").strip()
        track = (request.data.get("track") or "").strip().lower()
        accepts_male = bool(request.data.get("accepts_male", True))
        accepts_female = bool(request.data.get("accepts_female", True))
        accepts_sex_offender = bool(request.data.get("accepts_sex_offender", False))

        if not provider_id:
            return Response({"error": "provider_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not district_id:
            return Response({"error": "district_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({"error": "name is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not city:
            return Response({"error": "city is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not zip_code:
            return Response({"error": "zip_code is required."}, status=status.HTTP_400_BAD_REQUEST)

        valid_tracks = {choice[0] for choice in Facility.Track.choices}
        if track not in valid_tracks:
            return Response({"error": "track must be one of: basic, plus, hotel."}, status=status.HTTP_400_BAD_REQUEST)

        if not accepts_male and not accepts_female:
            return Response(
                {"error": "Facility must accept at least one of male or female placements."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            provider = Provider.objects.get(pk=provider_id)
        except Provider.DoesNotExist:
            return Response({"error": "Provider not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            district = District.objects.get(pk=district_id)
        except District.DoesNotExist:
            return Response({"error": "District not found."}, status=status.HTTP_404_NOT_FOUND)

        facility = Facility.objects.create(
            provider=provider,
            district=district,
            name=name,
            address=address,
            city=city,
            state=state,
            zip_code=zip_code,
            track=track,
            accepts_male=accepts_male,
            accepts_female=accepts_female,
            accepts_sex_offender=accepts_sex_offender,
            is_active=True,
        )

        return Response(
            {
                "message": f"Created facility {facility.name}.",
                "facility": {
                    "facility_id": facility.id,
                    "facility_name": facility.name,
                    "provider_name": provider.name,
                    "district_number": district.number,
                    "district_name": district.name,
                    "track": facility.track,
                    "is_active": facility.is_active,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class AdminFacilityRemoveView(APIView):
    """Remove a facility via soft or hard delete (admin only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, facility_id):
        admin_error = _require_admin_user(request)
        if admin_error is not None:
            return admin_error

        deletion_type = (request.data.get("deletion_type") or "soft").strip().lower()
        if deletion_type not in {"soft", "hard"}:
            return Response(
                {"error": "deletion_type must be either 'soft' or 'hard'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            facility = Facility.objects.select_related("provider").get(pk=facility_id)
        except Facility.DoesNotExist:
            return Response({"error": "Facility not found."}, status=status.HTTP_404_NOT_FOUND)

        if deletion_type == "soft" and not facility.is_active:
            return Response({"error": "Facility is already inactive."}, status=status.HTTP_409_CONFLICT)

        assigned_count = Bed.objects.filter(facility_id=facility.id, assigned_parolee__isnull=False).count()
        if assigned_count > 0:
            return Response(
                {"error": "Cannot remove a facility with currently assigned clients."},
                status=status.HTTP_409_CONFLICT,
            )

        if deletion_type == "hard":
            facility_name = facility.name
            facility.delete()
            return Response(
                {"message": f"Facility {facility_name} was permanently deleted."},
                status=status.HTTP_200_OK,
            )

        facility.is_active = False
        facility.save(update_fields=["is_active", "updated_at"])

        return Response(
            {"message": f"Facility {facility.name} was removed from active use."},
            status=status.HTTP_200_OK,
        )


class AdminFacilityToggleActiveView(APIView):
    """Toggle facility active status between active and inactive (admin only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, facility_id):
        admin_error = _require_admin_user(request)
        if admin_error is not None:
            return admin_error

        try:
            facility = Facility.objects.get(pk=facility_id)
        except Facility.DoesNotExist:
            return Response({"error": "Facility not found."}, status=status.HTTP_404_NOT_FOUND)

        facility.is_active = not facility.is_active
        facility.save(update_fields=["is_active", "updated_at"])

        return Response(
            {
                "message": (
                    f"Facility {facility.name} was reactivated."
                    if facility.is_active
                    else f"Facility {facility.name} was deactivated."
                ),
                "is_active": facility.is_active,
            },
            status=status.HTTP_200_OK,
        )


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

        _assign_parolee_to_bed(bed, parolee, request_user, assignment_note)

        return Response(
            {"message": f"Bed '{bed.label}' assigned to {parolee.last_name}, {parolee.first_name}."},
            status=status.HTTP_200_OK,
        )


class BedHoldRequestView(APIView):
    """Place a temporary hold on an available bed for testing workflows."""

    def post(self, request, bed_id):
        request_user = request.user if request.user.is_authenticated else None
        if request_user is None or getattr(request_user, "role", None) not in {User.Role.ADMIN, User.Role.IDOC_STAFF}:
            return Response(
                {"error": "Only IDOC staff and admins can request holds."},
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

        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
        hold_note = (
            f"[{event_time}] Hold requested for {parolee.last_name}, {parolee.first_name} "
            f"({parolee.idoc_id}) pending facility approval."
        )

        # Create hold record and append a visible audit note, but keep the bed available.
        Hold.objects.create(
            bed=bed,
            parolee=parolee,
            placed_by=request_user,
            reason="Testing hold request from main dashboard",
            expires_at=timezone.now() + timedelta(days=7),
        )

        bed.notes = f"{bed.notes}\n{hold_note}".strip() if bed.notes else hold_note
        bed.updated_by = request_user
        bed.save(update_fields=["updated_by", "notes", "updated_at"])

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
    throttle_classes = [LoginThrottle]

    def post(self, request):
        import logging
        logger = logging.getLogger('security')
        
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        password = request.data.get("password") or ""

        if not identifier or not password:
            return Response(
                {"error": "Username/email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = identifier
        if "@" in identifier:
            matched_user = User.objects.filter(email__iexact=identifier).first()
            if matched_user is not None:
                username = matched_user.username

        user = authenticate(request, username=username, password=password)
        if user is None:
            # SECURITY: Return the same error message for all invalid login attempts
            # This prevents user enumeration attacks where attackers can determine if an email exists
            logger.warning(f"Failed login attempt for identifier: {identifier}")
            return Response(
                {"error": "Invalid username/email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            logger.warning(f"Login attempt for disabled account: {user.username}")
            return Response(
                {"error": "Invalid username/email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)
        logger.info(f"Successful login for user: {user.username}")
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
    throttle_classes = [PasswordChangeThrottle]

    def post(self, request):
        import logging
        logger = logging.getLogger('security')
        
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
                # SECURITY: Return generic error message instead of specific validation details
                # This prevents attackers from learning password requirements
                errors["new_password"] = "Password does not meet security requirements"

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        
        # AUDIT: Log password change
        logger.info(f"Password changed for user: {request.user.username}")

        # Keep this browser session valid while invalidating sessions tied to the old auth hash.
        update_session_auth_hash(request, request.user)

        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)


class ProviderBedsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        _release_expired_provider_assignments(provider_id)

        beds = (
            Bed.objects.filter(facility__provider_id=provider_id)
            .select_related("facility", "facility__district", "assigned_parolee")
        )

        active_holds = {
            hold.bed_id: hold
            for hold in Hold.objects.filter(
                bed__facility__provider_id=provider_id,
                status=Hold.Status.ACTIVE,
            ).select_related("bed", "parolee")
        }

        for bed in beds:
            setattr(bed, "active_provider_hold", active_holds.get(bed.id))

        beds = sorted(beds, key=lambda bed: (bed.facility.name, *_bed_sort_key(bed)))
        return Response([_provider_bed_payload(bed) for bed in beds], status=status.HTTP_200_OK)


class ProviderFacilitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        facilities = (
            Facility.objects.filter(provider_id=provider_id)
            .select_related("district")
            .annotate(bed_count=Count("beds", distinct=True))
            .order_by("name")
        )

        return Response(
            [
                {
                    "facility_id": facility.id,
                    "facility_name": facility.name,
                    "district_number": facility.district.number,
                    "district_name": facility.district.name,
                    "bed_count": facility.bed_count,
                    "is_active": facility.is_active,
                }
                for facility in facilities
            ],
            status=status.HTTP_200_OK,
        )


class ProviderClientLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        idoc_id = (request.query_params.get("idoc_id") or "").strip()
        if not idoc_id:
            return Response({"error": "idoc_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            parolee = Parolee.objects.select_related("district", "assigned_bed", "assigned_bed__facility").get(idoc_id__iexact=idoc_id)
        except Parolee.DoesNotExist:
            return Response({"error": "No parolee exists with that client ID."}, status=status.HTTP_404_NOT_FOUND)

        return Response(_provider_parolee_payload(parolee), status=status.HTTP_200_OK)


class ProviderClientCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        idoc_id = (request.data.get("idoc_id") or "").strip()
        facility_id = request.data.get("facility_id")

        if not first_name:
            return Response({"error": "first_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not last_name:
            return Response({"error": "last_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not idoc_id:
            return Response({"error": "idoc_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if Parolee.objects.filter(idoc_id__iexact=idoc_id).exists():
            return Response({"error": "A client with that IDOC number already exists."}, status=status.HTTP_409_CONFLICT)

        if facility_id:
            try:
                facility = Facility.objects.select_related("district").get(pk=facility_id, provider_id=provider_id)
            except Facility.DoesNotExist:
                return Response({"error": "Facility not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            facility = _provider_default_facility(provider_id)
            if facility is None:
                return Response({"error": "Create a facility before adding clients."}, status=status.HTTP_400_BAD_REQUEST)

        parolee = Parolee.objects.create(
            idoc_id=idoc_id,
            first_name=first_name,
            last_name=last_name,
            district=facility.district,
        )

        return Response(_provider_parolee_payload(parolee), status=status.HTTP_201_CREATED)


class ProviderBedCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        facility_id = request.data.get("facility_id")
        label = (request.data.get("label") or "").strip()
        notes = (request.data.get("notes") or "").strip()
        is_sex_offender_bed = str(request.data.get("is_sex_offender_bed") or "").lower() in {"1", "true", "yes", "on"}

        if not facility_id:
            return Response({"error": "facility_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not label:
            return Response({"error": "label is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            facility = Facility.objects.get(pk=facility_id, provider_id=provider_id)
        except Facility.DoesNotExist:
            return Response({"error": "Facility not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if is_sex_offender_bed and not facility.accepts_sex_offender:
                facility.accepts_sex_offender = True
                facility.save(update_fields=["accepts_sex_offender", "updated_at"])

            bed = Bed.objects.create(
                facility=facility,
                label=label,
                notes=notes,
                is_sex_offender_bed=is_sex_offender_bed,
            )

        return Response(_provider_bed_payload(bed), status=status.HTTP_201_CREATED)


class ProviderHoldListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        holds = (
            Hold.objects.filter(bed__facility__provider_id=provider_id)
            .select_related("bed", "bed__facility", "parolee", "placed_by")
            .order_by("-created_at")
        )

        return Response(
            [
                {
                    "hold_id": hold.id,
                    "bed_id": hold.bed_id,
                    "bed_label": hold.bed.label,
                    "facility_name": hold.bed.facility.name,
                    "parolee_id": hold.parolee_id,
                    "client_id": hold.parolee.idoc_id,
                    "client_name": _provider_client_display_name(hold.parolee),
                    "status": hold.status,
                    "status_label": hold.get_status_display(),
                    "reason": hold.reason,
                    "created_at": hold.created_at,
                    "expires_at": hold.expires_at,
                    "placed_by": hold.placed_by.get_full_name().strip() if hold.placed_by else None,
                }
                for hold in holds
            ],


            status=status.HTTP_200_OK,
        )

    def post(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        bed_id = request.data.get("bed_id")
        reason = (request.data.get("reason") or "").strip()

        if not bed_id:
            return Response({"error": "bed_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bed = Bed.objects.select_related("facility", "facility__district").get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({"error": "Bed not found."}, status=status.HTTP_404_NOT_FOUND)

        if bed.facility.provider_id != provider_id:
            return Response({"error": "You can only manage holds for your own facilities."}, status=status.HTTP_403_FORBIDDEN)

        if bed.status != Bed.Status.AVAILABLE:
            return Response({"error": "Only available beds can be held."}, status=status.HTTP_409_CONFLICT)

        request_user = request.user if request.user.is_authenticated else None
        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
        hold_reason = reason or "Anonymous hold requested from the provider portal."

        with transaction.atomic():
            parolee = Parolee.objects.create(
                idoc_id=_generate_anonymous_idoc_id(),
                first_name="Anonymous",
                last_name="Hold",
                district=bed.facility.district,
            )
            hold = Hold.objects.create(
                bed=bed,
                parolee=parolee,
                placed_by=request_user,
                reason=hold_reason,
                expires_at=timezone.now() + timedelta(days=7),
            )

            _append_bed_note(
                bed,
                f"[{event_time}] Anonymous hold requested for bed {bed.label}.",
                request_user,
            )
            bed.save(update_fields=["updated_by", "notes", "updated_at"])

        return Response(
            {
                "message": f"Anonymous hold placed on {bed.label}.",
                "hold": _provider_bed_payload(bed, hold),
            },
            status=status.HTTP_201_CREATED,
        )


class ProviderHoldDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, hold_id, decision):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        try:
            hold = Hold.objects.select_related("bed", "bed__facility", "parolee").get(pk=hold_id)
        except Hold.DoesNotExist:
            return Response({"error": "Hold not found."}, status=status.HTTP_404_NOT_FOUND)

        if hold.bed.facility.provider_id != provider_id:
            return Response({"error": "You can only manage holds for your own facilities."}, status=status.HTTP_403_FORBIDDEN)

        if hold.status != Hold.Status.ACTIVE:
            return Response({"error": "Hold is no longer active."}, status=status.HTTP_409_CONFLICT)

        request_user = request.user if request.user.is_authenticated else None
        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")

        if decision == "approve":
            if hold.parolee.assigned_bed is not None:
                return Response({"error": "That client already has an assigned bed."}, status=status.HTTP_409_CONFLICT)

            if hold.bed.status not in {Bed.Status.AVAILABLE, Bed.Status.HELD}:
                return Response({"error": "That bed is not available for approval."}, status=status.HTTP_409_CONFLICT)

            note = (
                f"[{event_time}] Hold approved for {hold.parolee.last_name}, {hold.parolee.first_name} "
                f"({hold.parolee.idoc_id})."
            )
            with transaction.atomic():
                _assign_parolee_to_bed(hold.bed, hold.parolee, request_user, note)
                hold.status = Hold.Status.CONVERTED
                hold.save(update_fields=["status"])

            return Response(
                {
                    "message": f"Hold approved for {hold.parolee.idoc_id}.",
                    "hold_id": hold.id,
                    "bed": _provider_bed_payload(hold.bed),
                },
                status=status.HTTP_200_OK,
            )

        if decision == "deny":
            note = (
                f"[{event_time}] Hold denied for {hold.parolee.last_name}, {hold.parolee.first_name} "
                f"({hold.parolee.idoc_id})."
            )
            with transaction.atomic():
                _append_bed_note(hold.bed, note, request_user)
                hold.status = Hold.Status.CANCELLED
                hold.save(update_fields=["status"])
                hold.bed.status = Bed.Status.AVAILABLE
                hold.bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])

            return Response(
                {
                    "message": f"Hold denied for {hold.parolee.idoc_id}.",
                    "hold_id": hold.id,
                    "bed": _provider_bed_payload(hold.bed),
                },
                status=status.HTTP_200_OK,
            )

        return Response({"error": "decision must be approve or deny."}, status=status.HTTP_400_BAD_REQUEST)


class ProviderPlacementEndDateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, parolee_id):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        try:
            parolee = Parolee.objects.select_related("assigned_bed", "assigned_bed__facility").get(pk=parolee_id)
        except Parolee.DoesNotExist:
            return Response({"error": "Parolee not found."}, status=status.HTTP_404_NOT_FOUND)

        if parolee.assigned_bed is None:
            return Response({"error": "That client is not currently assigned to a bed."}, status=status.HTTP_409_CONFLICT)

        if parolee.assigned_bed.facility.provider_id != provider_id:
            return Response({"error": "You can only update placements for your own facilities."}, status=status.HTTP_403_FORBIDDEN)

        raw_end_date = request.data.get("housing_end_date") or request.data.get("end_date")
        if not raw_end_date:
            return Response({"error": "housing_end_date is required."}, status=status.HTTP_400_BAD_REQUEST)

        housing_end_date = parse_date(str(raw_end_date))
        if housing_end_date is None:
            return Response({"error": "housing_end_date must be a valid date."}, status=status.HTTP_400_BAD_REQUEST)

        if parolee.housing_start_date and housing_end_date < parolee.housing_start_date:
            return Response({"error": "housing_end_date cannot be earlier than housing_start_date."}, status=status.HTTP_400_BAD_REQUEST)

        request_user = request.user if request.user.is_authenticated else None
        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")

        parolee.housing_end_date = housing_end_date
        parolee.save(update_fields=["housing_end_date"])

        if housing_end_date < timezone.now().date():
            note = (
                f"[{event_time}] Placement ended early on {housing_end_date} for "
                f"{parolee.last_name}, {parolee.first_name} ({parolee.idoc_id})."
            )
            with transaction.atomic():
                _append_bed_note(parolee.assigned_bed, note, request_user)
                parolee.assigned_bed.status = Bed.Status.AVAILABLE
                parolee.assigned_bed.save(update_fields=["status", "updated_by", "notes", "updated_at"])
                parolee.assigned_bed = None
                parolee.save(update_fields=["assigned_bed"])

            return Response(
                {
                    "message": f"Placement ended early for {parolee.idoc_id}.",
                    "housing_end_date": housing_end_date,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "message": f"Updated end date for {parolee.idoc_id}.",
                "housing_end_date": housing_end_date,
            },
            status=status.HTTP_200_OK,
        )


class ProviderAssignClientView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        provider_id = _require_provider_user(request)
        if not isinstance(provider_id, int):
            return provider_id

        _release_expired_provider_assignments(provider_id)

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

        if bed.facility.provider_id != provider_id:
            return Response({"error": "You can only update beds for your own facilities."}, status=status.HTTP_403_FORBIDDEN)

        try:
            parolee = Parolee.objects.select_related("district", "assigned_bed", "assigned_bed__facility").get(idoc_id__iexact=idoc_id)
        except Parolee.DoesNotExist:
            return Response({"error": "No parolee exists with that client ID."}, status=status.HTTP_404_NOT_FOUND)

        if bed.status != Bed.Status.AVAILABLE:
            return Response({"error": "Selected bed is not available."}, status=status.HTTP_409_CONFLICT)

        if parolee.assigned_bed is not None:
            return Response({"error": "That client already has an assigned bed."}, status=status.HTTP_409_CONFLICT)

        request_user = request.user if request.user.is_authenticated else None
        event_time = timezone.now().strftime("%Y-%m-%d %H:%M:%S %Z")
        assignment_note = (
            f"[{event_time}] Assigned to {parolee.last_name}, {parolee.first_name} ({parolee.idoc_id})."
        )
        housing_start_date, housing_end_date = _assign_parolee_to_bed(bed, parolee, request_user, assignment_note)

        return Response(
            {
                "message": f"Assigned {parolee.idoc_id} to {bed.label} at {bed.facility.name}.",
                "bed_id": bed.id,
                "client_id": parolee.idoc_id,
                "client_name": _person_name(parolee),
                "housing_start_date": housing_start_date,
                "housing_end_date": housing_end_date,
            },
            status=status.HTTP_200_OK,
        )

