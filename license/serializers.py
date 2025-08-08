from rest_framework import serializers

from license.models import LicenseImportItemsModel


class LicenseImportItemsSelectSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return f"{obj.license.license_number} - {obj.serial_number}"

    class Meta:
        model = LicenseImportItemsModel
        fields = ['id', 'display_name']


from rest_framework import serializers
from core.models import HSCodeModel, ItemNameModel, CompanyModel, PortModel
from core.serializers import HSCodeSerializer, ItemNameSerializer, CompanySerializer, PortSerializer
from license.models import LicenseDetailsModel, LicenseExportItemModel, LicenseImportItemsModel


class LicenseExportItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    norm_class_name = serializers.CharField(source='norm_class', read_only=True)

    class Meta:
        model = LicenseExportItemModel
        fields = [
            'id', 'description', 'net_quantity', 'unit', 'currency',
            'cif_fc', 'cif_inr', 'norm_class', 'norm_class_name',
        ]


class LicenseImportItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    hs_code = HSCodeSerializer(read_only=True)
    hs_code_id = serializers.PrimaryKeyRelatedField(
        queryset=HSCodeModel.objects.all(), source='hs_code', write_only=True
    )
    items = ItemNameSerializer(read_only=True, many=True)
    items_ids = serializers.PrimaryKeyRelatedField(
        queryset=ItemNameModel.objects.all(), source='items', many=True, write_only=True
    )

    class Meta:
        model = LicenseImportItemsModel
        fields = [
            'id', 'serial_number', 'description', 'quantity', 'unit',
            'cif_fc', 'cif_inr', 'hs_code', 'hs_code_id', 'items', 'items_ids'
        ]


class LicenseDetailsSerializer(serializers.ModelSerializer):
    export_license = LicenseExportItemSerializer(many=True)
    import_license = LicenseImportItemSerializer(many=True)

    exporter = CompanySerializer(read_only=True)
    exporter_id = serializers.PrimaryKeyRelatedField(queryset=CompanyModel.objects.all(), write_only=True)
    port_id = serializers.PrimaryKeyRelatedField(queryset=PortModel.objects.all(), write_only=True)
    port = PortSerializer(read_only=True)

    class Meta:
        model = LicenseDetailsModel
        fields = [
            'id', 'license_number', 'license_date', 'license_expiry_date', 'file_number', 'registration_date',
            'registration_number', 'purchase_status', 'is_active', 'is_expired', 'is_incomplete', 'is_not_registered',
            'is_au', 'is_audit', 'balance_cif', 'get_balance_cif', 'modified_on', 'scheme_code', 'notification_number',
            'exporter', 'exporter_id', 'port', 'port_id', 'export_license', 'import_license'
        ]

    def create(self, validated_data):
        export_items_data = validated_data.pop('export_license')
        import_items_data = validated_data.pop('import_license')
        exporter = validated_data.pop('exporter_id')
        port = validated_data.pop('port_id')

        license_detail = LicenseDetailsModel.objects.create(exporter=exporter, port=port, **validated_data)

        # Create export license items
        for item in export_items_data:
            LicenseExportItemModel.objects.create(license=license_detail, **item)

        # Create import license items with nested many-to-many items
        for item_data in import_items_data:
            items = item_data.pop('items', [])
            import_item = LicenseImportItemsModel.objects.create(license=license_detail, **item_data)
            import_item.items.set(items)

        return license_detail

    def update(self, instance, validated_data):
        export_items_data = validated_data.pop('export_license', None)
        import_items_data = validated_data.pop('import_license', None)

        if 'exporter_id' in validated_data:
            instance.exporter = validated_data.pop('exporter_id')
        if 'port_id' in validated_data:
            instance.port = validated_data.pop('port_id')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update export license items
        if export_items_data is not None:
            instance.export_license.all().delete()
            for item in export_items_data:
                LicenseExportItemModel.objects.create(license=instance, **item)

        # Update import license items and their M2M relationships
        if import_items_data is not None:
            instance.import_license.all().delete()
            for item_data in import_items_data:
                items = item_data.pop('items', [])
                import_item = LicenseImportItemsModel.objects.create(license=instance, **item_data)
                import_item.items.set(items)

        return instance
