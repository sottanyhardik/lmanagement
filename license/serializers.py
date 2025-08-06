from rest_framework import serializers

from core.serializers import CompanyOptionSerializer, PortOptionSerializer
from license.models import LicenseDetailsModel, LicenseExportItemModel, LicenseImportItemsModel


class LicenseImportItemsSelectSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return f"{obj.license.license_number} - {obj.serial_number}"

    class Meta:
        model = LicenseImportItemsModel
        fields = ['id', 'display_name']


class LicenseExportItemSerializer(serializers.ModelSerializer):
    norm_class_name = serializers.CharField(source='norm_class', read_only=True)

    class Meta:
        model = LicenseExportItemModel
        fields = [
            'id', 'description', 'net_quantity', 'unit', 'currency',
            'cif_fc', 'cif_inr', 'norm_class', 'norm_class_name',
        ]


class LicenseImportItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicenseImportItemsModel
        fields = '__all__'


class LicenseDetailsSerializer(serializers.ModelSerializer):
    exporter = CompanyOptionSerializer()
    port = PortOptionSerializer()
    export_items = LicenseExportItemSerializer(source='export_license', many=True, read_only=True)
    import_items = LicenseImportItemSerializer(source='import_license', many=True, read_only=True)

    class Meta:
        model = LicenseDetailsModel
        fields = '__all__'
