# accounts/serializers.py
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


def _full_name(obj: User) -> str:
    if hasattr(obj, "get_full_name"):
        return (obj.get_full_name() or "").strip()
    return f"{getattr(obj, 'first_name', '')} {getattr(obj, 'last_name', '')}".strip()


class UserSerializer(serializers.ModelSerializer):
    """For normal clients (current user, non-admin lists)."""
    full_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "full_name"]
        read_only_fields = ["id", "username"]  # keep username immutable once created

    def get_full_name(self, obj):
        return _full_name(obj)


class UserCreateSerializer(serializers.ModelSerializer):
    """For registration."""
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name"]

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already in use.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        # create_user hashes the password and handles required fields
        return User.objects.create_user(password=password, **validated_data)


class AdminUserSerializer(UserSerializer):
    """For admin endpoints only."""

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["is_active", "is_staff", "is_superuser", "last_login", "date_joined"]
        read_only_fields = UserSerializer.Meta.read_only_fields + ["last_login", "date_joined"]


class SetPasswordSerializer(serializers.Serializer):
    """For admin set-password or a change-password endpoint."""
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
