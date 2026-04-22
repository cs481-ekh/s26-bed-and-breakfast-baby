from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from .encryption import EncryptedField, EncryptedCharField


# ===========================================================================
# Custom User Model with Role-Based Access
# ===========================================================================

class User(AbstractUser):
    """
    Extended user model supporting role-based dashboards.
    Roles: Admin, Case Manager, Provider Staff
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        CASE_MANAGER = "case_manager", "Case Manager"
        PAROLE_OFFICER = "parole_officer", "Parole Officer"
        PROVIDER = "provider", "Housing Provider"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CASE_MANAGER,
    )
    # Contact phone number - encrypted
    phone = EncryptedCharField(max_length=300, blank=True)

    # Case managers belong to a judicial district
    district = models.ForeignKey(
        "District",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
        help_text="Judicial district (for case managers)",
    )

    # Provider staff are linked to a housing provider
    provider = models.ForeignKey(
        "Provider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
        help_text="Associated provider (for provider users)",
    )

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"


class Invite(models.Model):
    """
    Secure invitation tokens for account creation.
    Tokens expire after a set period and can only be used once.
    """
    email = models.EmailField()
    role = models.CharField(
        max_length=20,
        choices=User.Role.choices,
        default=User.Role.CASE_MANAGER,
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_invites",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite for {self.email} ({self.get_role_display()})"

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def is_used(self):
        return self.used_at is not None


# ===========================================================================
# Geographic / Organizational
# ===========================================================================

class District(models.Model):
    """
    Idaho's seven judicial districts.
    Used for filtering beds and associating case managers.
    """
    number = models.PositiveSmallIntegerField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["number"]

    def __str__(self):
        return f"District {self.number} – {self.name}"


class Provider(models.Model):
    """
    A housing organization that operates one or more facilities.
    """
    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=150, blank=True)
    # Contact information - encrypted for security
    contact_email = EncryptedCharField(max_length=1000, blank=True)
    contact_phone = EncryptedCharField(max_length=300, blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Facility(models.Model):
    """
    A physical housing location belonging to a provider.
    A provider may operate multiple facilities across different districts.
    """

    class Track(models.TextChoices):
        BASIC = "basic", "Basic"
        PLUS = "plus", "Plus"
        HOTEL = "hotel", "Hotel"

    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="facilities",
    )
    name = models.CharField(max_length=200)
    # Facility address - encrypted for security
    address = EncryptedField(blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2, default="ID")
    zip_code = models.CharField(max_length=10)
    district = models.ForeignKey(
        District,
        on_delete=models.PROTECT,
        related_name="facilities",
    )
    track = models.CharField(
        max_length=10,
        choices=Track.choices,
        help_text="IDOC housing track standard",
    )
    accepts_male = models.BooleanField(default=True)
    accepts_female = models.BooleanField(default=True)
    accepts_sex_offender = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "facilities"

    def __str__(self):
        return f"{self.name} ({self.provider.name})"


# ===========================================================================
# Programs
# ===========================================================================

class Program(models.Model):
    """
    A program type offered at a facility (e.g., substance abuse treatment,
    mental health support, work release). Facilities can offer multiple
    programs, and programs can exist at multiple facilities.
    """
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    eligibility_criteria = models.TextField(
        blank=True,
        help_text="Requirements a parolee must meet to qualify",
    )
    facilities = models.ManyToManyField(
        Facility,
        related_name="programs",
        blank=True,
    )

    def __str__(self):
        return self.name


# ===========================================================================
# Beds
# ===========================================================================

class Bed(models.Model):
    """
    An individual bed within a facility.
    Tracks current status and assignment history.
    """

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        OCCUPIED = "occupied", "Occupied"
        HELD = "held", "Held"
        MAINTENANCE = "maintenance", "Maintenance"

    facility = models.ForeignKey(
        Facility,
        on_delete=models.CASCADE,
        related_name="beds",
    )
    label = models.CharField(
        max_length=50,
        help_text="Bed identifier within the facility (e.g., 'Room 3 - Bed A')",
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    is_sex_offender_bed = models.BooleanField(
        default=False,
        help_text="Whether this bed is designated for sex-offender eligible placements",
    )
    # Bed-specific notes - encrypted for security
    notes = EncryptedField(blank=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_beds",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["facility", "label"]

    def clean(self):
        super().clean()
        if not self.is_sex_offender_bed:
            return

        if self.facility_id is None:
            return

        if not self.facility.accepts_sex_offender:
            raise ValidationError(
                {"is_sex_offender_bed": "This facility is not configured to accept sex-offender placements."}
            )

        designated_count = Bed.objects.filter(
            facility_id=self.facility_id,
            is_sex_offender_bed=True,
        ).exclude(pk=self.pk).count()
        if designated_count >= 2:
            raise ValidationError(
                {"is_sex_offender_bed": "Each facility can designate at most 2 sex-offender beds."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.label} @ {self.facility.name} [{self.get_status_display()}]"


# ===========================================================================
# Parolees (minimal profile — no PII beyond name and ID)
# ===========================================================================

class Parolee(models.Model):
    """
    Minimal parolee record for bed assignment tracking.
    Sensitive PII is encrypted at rest.
    """
    # government ID - NOT encrypted because it's used as a queryable unique identifier
    idoc_id = models.CharField(
        max_length=50,
        unique=True,
        help_text="IDOC-assigned identifier",
    )
    first_name = EncryptedField(help_text="First name (encrypted)")
    last_name = EncryptedField(help_text="Last name (encrypted)")
    district = models.ForeignKey(
        District,
        on_delete=models.PROTECT,
        related_name="parolees",
    )
    assigned_bed = models.OneToOneField(
        Bed,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_parolee",
    )
    housing_start_date = models.DateField(null=True, blank=True)
    housing_end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.last_name}, {self.first_name} ({self.idoc_id})"


# ===========================================================================
# Holds — temporary bed reservations
# ===========================================================================

class Hold(models.Model):
    """
    A temporary hold placed on a bed by a case manager while
    administrative paperwork is being processed.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EXPIRED = "expired", "Expired"
        CONVERTED = "converted", "Converted to Placement"
        CANCELLED = "cancelled", "Cancelled"

    bed = models.ForeignKey(
        Bed,
        on_delete=models.CASCADE,
        related_name="holds",
    )
    parolee = models.ForeignKey(
        Parolee,
        on_delete=models.CASCADE,
        related_name="holds",
    )
    placed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="holds_placed",
    )
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    # Hold reason - encrypted for security
    reason = EncryptedField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="When the hold automatically expires",
    )

    def __str__(self):
        return f"Hold on {self.bed} for {self.parolee} [{self.get_status_display()}]"


# ===========================================================================
# Waitlist — standby list when no beds are available
# ===========================================================================

class WaitlistEntry(models.Model):
    """
    Places a parolee on a standby list for a specific facility
    when no beds are immediately available.
    """

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    parolee = models.ForeignKey(
        Parolee,
        on_delete=models.CASCADE,
        related_name="waitlist_entries",
    )
    facility = models.ForeignKey(
        Facility,
        on_delete=models.CASCADE,
        related_name="waitlist_entries",
    )
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="waitlist_entries_added",
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    # Sensitive placement notes - encrypted for security
    notes = EncryptedField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "waitlist entries"
        ordering = [
            models.Case(
                models.When(priority="urgent", then=0),
                models.When(priority="high", then=1),
                models.When(priority="medium", then=2),
                models.When(priority="low", then=3),
            ),
            "created_at",
        ]

    def __str__(self):
        return f"{self.parolee} → {self.facility.name} ({self.get_priority_display()})"
