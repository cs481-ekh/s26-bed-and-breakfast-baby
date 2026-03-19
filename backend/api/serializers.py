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
    class Meta:
        model = Bed
        fields = ['id', 'label', 'status']


class ParoleeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parolee
        fields = ['id', 'idoc_id', 'first_name', 'last_name']
