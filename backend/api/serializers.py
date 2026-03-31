from rest_framework import serializers
from housing.models import User, Bed, Parolee


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
        fields = ['id', 'label', 'status', 'notes', 'updated_at', 'updated_by', 'can_edit_notes']


class ParoleeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parolee
        fields = ['id', 'idoc_id', 'first_name', 'last_name']
