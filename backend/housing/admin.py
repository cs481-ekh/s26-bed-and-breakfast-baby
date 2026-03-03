from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, District, Provider, Facility, Program,
    Bed, Parolee, Hold, WaitlistEntry,
)


# ===========================================================================
# User
# ===========================================================================

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "first_name", "last_name", "role", "district", "provider", "is_active")
    list_filter = ("role", "district", "is_active")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("IDOC Role Info", {
            "fields": ("role", "phone", "district", "provider"),
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("IDOC Role Info", {
            "fields": ("role", "phone", "district", "provider"),
        }),
    )


# ===========================================================================
# Geographic / Organizational
# ===========================================================================

@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("number", "name")
    ordering = ("number",)


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_name", "contact_email", "contact_phone", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "contact_name", "contact_email")


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = ("name", "provider", "city", "district", "tier", "is_active", "bed_count")
    list_filter = ("district", "tier", "is_active")
    search_fields = ("name", "city", "provider__name")

    @admin.display(description="Beds")
    def bed_count(self, obj):
        return obj.beds.count()


# ===========================================================================
# Programs
# ===========================================================================

@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ("name", "facility_count")
    filter_horizontal = ("facilities",)

    @admin.display(description="Facilities")
    def facility_count(self, obj):
        return obj.facilities.count()


# ===========================================================================
# Beds
# ===========================================================================

@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ("label", "facility", "status", "updated_at")
    list_filter = ("status", "facility__district", "facility")
    search_fields = ("label", "facility__name")
    list_editable = ("status",)


# ===========================================================================
# Parolees
# ===========================================================================

@admin.register(Parolee)
class ParoleeAdmin(admin.ModelAdmin):
    list_display = ("idoc_id", "last_name", "first_name", "district", "assigned_bed", "housing_end_date")
    list_filter = ("district",)
    search_fields = ("idoc_id", "first_name", "last_name")


# ===========================================================================
# Holds
# ===========================================================================

@admin.register(Hold)
class HoldAdmin(admin.ModelAdmin):
    list_display = ("bed", "parolee", "placed_by", "status", "created_at", "expires_at")
    list_filter = ("status",)
    search_fields = ("parolee__last_name", "parolee__idoc_id")


# ===========================================================================
# Waitlist
# ===========================================================================

@admin.register(WaitlistEntry)
class WaitlistEntryAdmin(admin.ModelAdmin):
    list_display = ("parolee", "facility", "priority", "is_active", "added_by", "created_at")
    list_filter = ("priority", "is_active", "facility__district")
    search_fields = ("parolee__last_name", "parolee__idoc_id", "facility__name")
