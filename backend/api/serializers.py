from rest_framework import serializers
from housing.models import User, Bed, Parolee
from django.utils import timezone


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model.
    """
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'phone',
            'role',
            'is_active',
            'date_joined',
        ]
        read_only_fields = ['id', 'date_joined']


class BedSerializer(serializers.ModelSerializer):
    can_edit_notes = serializers.SerializerMethodField()
    updated_by = serializers.SerializerMethodField()

    def get_can_edit_notes(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and getattr(user, 'role', None) == User.Role.ADMIN
        )

    def get_updated_by(self, obj):
        if obj.updated_by is None:
            return None

        full_name = obj.updated_by.get_full_name().strip()
        return full_name or obj.updated_by.username

    class Meta:
        model = Bed
        fields = ['id', 'label', 'status', 'is_sex_offender_bed', 'notes', 'updated_at', 'updated_by', 'can_edit_notes']


class ParoleeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parolee
        fields = ['id', 'idoc_id', 'first_name', 'last_name']


class AdminClientSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    district_number = serializers.IntegerField(source='district.number', read_only=True)
    district_name = serializers.CharField(source='district.name', read_only=True)
    assigned_bed_label = serializers.CharField(source='assigned_bed.label', read_only=True)
    assigned_facility_name = serializers.CharField(source='assigned_bed.facility.name', read_only=True)
    date_added = serializers.SerializerMethodField()
    months_in_system = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return f"{obj.last_name}, {obj.first_name}"

    def get_date_added(self, obj):
        if obj.created_at is None:
            return None
        return obj.created_at.date().isoformat()

    def get_months_in_system(self, obj):
        if obj.created_at is None:
            return 0

        today = timezone.now().date()
        added_on = obj.created_at.date()
        months = (today.year - added_on.year) * 12 + (today.month - added_on.month)
        if today.day < added_on.day:
            months -= 1
        return max(months, 0)

    class Meta:
        model = Parolee
        fields = [
            'id',
            'idoc_id',
            'first_name',
            'last_name',
            'full_name',
            'district_number',
            'district_name',
            'assigned_bed_label',
            'assigned_facility_name',
            'housing_start_date',
            'housing_end_date',
            'date_added',
            'months_in_system',
        ]
