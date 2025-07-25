from rest_framework import serializers

from license.models import LicenseImportItemsModel


class LicenseImportItemOptionSerializer(serializers.ModelSerializer):
    license_number = serializers.CharField(source='license.license_number')

    class Meta:
        model = LicenseImportItemsModel
        fields = ['id', 'serial_number', 'license_number']
