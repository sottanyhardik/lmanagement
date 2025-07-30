from rest_framework import serializers

from license.models import LicenseImportItemsModel


class LicenseImportItemsSelectSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return f"{obj.license.license_number} - {obj.serial_number}"

    class Meta:
        model = LicenseImportItemsModel
        fields = ['id', 'display_name']
