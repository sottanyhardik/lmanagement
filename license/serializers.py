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
from core.models import HSCodeModel, ItemNameModel, CompanyModel, PortModel, SionNormClassModel
from core.serializers import HSCodeSerializer, ItemNameSerializer, CompanySerializer, PortSerializer, \
    SionNormClassSerializer
from license.models import LicenseDetailsModel, LicenseExportItemModel, LicenseImportItemsModel


class LicenseExportItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    norm_class = SionNormClassSerializer(read_only=True)
    norm_class_id = serializers.PrimaryKeyRelatedField(
        queryset=SionNormClassModel.objects.all(), source='norm_class', write_only=True
    )

    class Meta:
        model = LicenseExportItemModel
        fields = [
            'id', 'description', 'net_quantity', 'unit', 'currency',
            'cif_fc', 'cif_inr', 'norm_class', 'norm_class_id',
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


from django.db import transaction
from django.db.models.deletion import ProtectedError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError


class LicenseDetailsSerializer(serializers.ModelSerializer):
    export_license = LicenseExportItemSerializer(many=True)
    import_license = LicenseImportItemSerializer(many=True)

    exporter = CompanySerializer(read_only=True)
    exporter_id = serializers.PrimaryKeyRelatedField(
        queryset=CompanyModel.objects.all(), write_only=True
    )
    port_id = serializers.PrimaryKeyRelatedField(
        queryset=PortModel.objects.all(), write_only=True
    )
    port = PortSerializer(read_only=True)

    class Meta:
        model = LicenseDetailsModel
        fields = [
            'id', 'license_number', 'license_date', 'license_expiry_date', 'file_number',
            'registration_date', 'registration_number', 'purchase_status', 'is_active',
            'is_expired', 'is_incomplete', 'is_not_registered', 'is_au', 'is_audit',
            'balance_cif', 'get_balance_cif', 'modified_on', 'scheme_code',
            'notification_number', 'exporter', 'exporter_id', 'port', 'port_id',
            'export_license', 'import_license'
        ]

    # ---------- helpers ----------
    def _is_linked(self, obj, ignore_relations=('license', 'items')):
        """
        Return True if `obj` has any non-empty reverse relations other than the
        relation back to License and the 'items' M2M itself.
        """
        for rel in obj._meta.related_objects:
            accessor = rel.get_accessor_name()
            if accessor in ignore_relations:
                continue
            # OneToOne / ForeignKey reverse -> use getattr(obj, accessor)
            if rel.one_to_one or rel.one_to_many:
                manager_or_obj = getattr(obj, accessor, None)
                if manager_or_obj is None:
                    continue
                # one-to-one gives an object (exists -> linked)
                if rel.one_to_one:
                    try:
                        getattr(obj, accessor)
                        return True
                    except rel.related_model.DoesNotExist:
                        continue
                # one-to-many gives a manager
                if hasattr(manager_or_obj, 'exists') and manager_or_obj.exists():
                    return True
            # many-to-many (other than 'items')
            elif rel.many_to_many:
                manager = getattr(obj, accessor, None)
                if manager is not None and manager.exists():
                    return True
        return False

    def _upsert_export_items(self, instance, items_data):
        """
        Upsert for LicenseExportItemModel:
        - update existing by id
        - create new if no id
        - delete those missing from payload only if not linked
        """
        existing_qs = instance.export_license.all()
        existing_by_id = {str(it.id): it for it in existing_qs}

        seen_ids = set()
        for item in items_data:
            item_id = item.get('id')
            if item_id:
                seen_ids.add(str(item_id))
                obj = existing_by_id.get(str(item_id))
                if not obj:
                    raise ValidationError({'export_license': [f'Export item {item_id} not found.']})
                for k, v in item.items():
                    if k == 'id':
                        continue
                    setattr(obj, k, v)
                obj.save()
            else:
                LicenseExportItemModel.objects.create(license=instance, **item)

        # Deletions (only those not present in payload)
        to_delete = [obj for _id, obj in existing_by_id.items() if _id not in seen_ids]
        for obj in to_delete:
            try:
                if self._is_linked(obj):
                    raise ValidationError(
                        {'export_license': [f"Cannot delete export item {obj.id}: it is linked to other records."]}
                    )
                obj.delete()
            except ProtectedError:
                raise ValidationError(
                    {'export_license': [f"Cannot delete export item {obj.id}: protected by related records."]}
                )

    def _upsert_import_items(self, instance, items_data):
        """
        Upsert for LicenseImportItemsModel including M2M 'items':
        - update existing by id (and reset M2M)
        - create new if no id
        - delete those missing from payload only if not linked
        """
        existing_qs = instance.import_license.all()
        existing_by_id = {str(it.id): it for it in existing_qs}

        seen_ids = set()
        for item in items_data:
            # Support both 'items' (list of PKs) and 'items_ids'
            m2m_ids = item.pop('items_ids', None)
            if m2m_ids is not None:
                item['items'] = m2m_ids

            item_id = item.get('id')
            raw_items = item.pop('items', [])

            if item_id:
                seen_ids.add(str(item_id))
                obj = existing_by_id.get(str(item_id))
                if not obj:
                    raise ValidationError({'import_license': [f'Import item {item_id} not found.']})

                # scalar fields
                for k, v in item.items():
                    if k == 'id':
                        continue
                    setattr(obj, k, v)
                obj.save()

                # M2M reset
                if raw_items is not None:
                    obj.items.set(raw_items)
            else:
                # create
                m2m = raw_items
                obj = LicenseImportItemsModel.objects.create(license=instance, **item)
                if m2m is not None:
                    obj.items.set(m2m)

        # Deletions (only those not present in payload)
        to_delete = [obj for _id, obj in existing_by_id.items() if _id not in seen_ids]
        for obj in to_delete:
            try:
                if self._is_linked(obj, ignore_relations=('license', 'items')):
                    raise ValidationError(
                        {'import_license': [f"Cannot delete import item {obj.id}: it is linked to other records."]}
                    )
                obj.delete()
            except ProtectedError:
                raise ValidationError(
                    {'import_license': [f"Cannot delete import item {obj.id}: protected by related records."]}
                )

    # ---------- CRUD ----------
    @transaction.atomic
    def create(self, validated_data):
        export_items_data = validated_data.pop('export_license', [])
        import_items_data = validated_data.pop('import_license', [])
        exporter = validated_data.pop('exporter_id')
        port = validated_data.pop('port_id')

        license_detail = LicenseDetailsModel.objects.create(
            exporter=exporter, port=port, **validated_data
        )

        # export items
        for item in export_items_data:
            LicenseExportItemModel.objects.create(license=license_detail, **item)

        # import items (with M2M)
        for item in import_items_data:
            m2m = item.pop('items', [])
            import_obj = LicenseImportItemsModel.objects.create(license=license_detail, **item)
            if m2m:
                import_obj.items.set(m2m)

        return license_detail

    @transaction.atomic
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

        # Upsert export items
        if export_items_data is not None:
            self._upsert_export_items(instance, export_items_data)

        # Upsert import items
        if import_items_data is not None:
            self._upsert_import_items(instance, import_items_data)

        return instance
