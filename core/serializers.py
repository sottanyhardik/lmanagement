import re

from rest_framework import serializers

from .models import PortModel, ItemHeadModel, ItemNameModel, HSCodeModel, SIONImportModel, \
    SIONExportModel, SionNormClassModel, HeadSIONNormsModel, TransferLetterModel, InvoiceEntity, CompanyModel

PAN_RE = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$', re.IGNORECASE)
GST_RE = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$', re.IGNORECASE)


# ports/serializers.py
class PortOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortModel
        fields = ['id', 'code', 'name']


class CompanyOptionSerializer(serializers.ModelSerializer):
    pan = serializers.CharField(required=False, allow_blank=True, max_length=10)
    gst_number = serializers.CharField(required=False, allow_blank=True, max_length=15)

    class Meta:
        model = CompanyModel
        fields = ['id', 'name', 'address_line_1', 'address_line_2', 'pan', 'gst_number']

    def validate_pan(self, value):
        v = (value or '').strip().upper()
        if v and not PAN_RE.fullmatch(v):
            raise serializers.ValidationError(
                'PAN must be 10 chars: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F).'
            )
        return v

    def validate_gst_number(self, value):
        v = (value or '').strip().upper()
        if v and not GST_RE.fullmatch(v):
            raise serializers.ValidationError(
                'GSTIN must be 15 chars: 2 digits + PAN + 1 alnum + Z + 1 alnum (e.g., 27ABCDE1234F1Z5).'
            )
        return v

    def validate(self, attrs):
        pan = (attrs.get('pan') or (self.instance.pan if self.instance else '')).strip().upper()
        gst = (attrs.get('gst_number') or (self.instance.gst_number if self.instance else '')).strip().upper()
        if pan and gst and len(gst) == 15 and gst[2:12] != pan:
            raise serializers.ValidationError({'gst_number': 'GSTIN PAN segment does not match PAN.'})
        return attrs


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyModel
        fields = '__all__'


class PortSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortModel
        fields = ['id', 'code', 'name']


class ItemHeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemHeadModel
        fields = ['id', 'name', 'is_restricted', 'dict_key']


class ItemNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemNameModel
        fields = ['id', 'name', 'head', 'unit_price']


class HSCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HSCodeModel
        fields = ['id', 'hs_code', 'product_description']


class TransferLetterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransferLetterModel
        fields = ['id', 'name', 'tl']


class SIONImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SIONImportModel
        fields = ['id', 'sr_no', 'description', 'quantity', 'unit', 'condition']


class SIONExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SIONExportModel
        fields = ['id', 'description', 'quantity', 'unit']


class HeadSIONNormsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeadSIONNormsModel
        fields = ['id', 'name']


class SionNormClassSerializer(serializers.ModelSerializer):
    head_norm = HeadSIONNormsSerializer(read_only=True)
    head_norm_id = serializers.PrimaryKeyRelatedField(
        queryset=HeadSIONNormsModel.objects.all(), source='head_norm', write_only=True
    )
    export_norm = SIONExportSerializer(many=True)
    import_norm = SIONImportSerializer(many=True)

    class Meta:
        model = SionNormClassModel
        fields = [
            'id',
            'norm_class',
            'description',
            'head_norm', 'head_norm_id',
            'export_norm',
            'import_norm',
        ]

    def update(self, instance, validated_data):
        instance.norm_class = validated_data.get('norm_class', instance.norm_class)
        instance.description = validated_data.get('description', instance.description)
        instance.head_norm = validated_data.get('head_norm', instance.head_norm)
        instance.modified_by = self.context['request'].user
        instance.save()

        # Export Norm (should be one-to-many now, but used like one-to-one)
        export_data = validated_data.pop('export_norm', [])
        for item in export_data:
            if 'id' in item:
                export_instance = SIONExportModel.objects.get(id=item['id'], norm_class=instance)
                for attr, value in item.items():
                    setattr(export_instance, attr, value)
                export_instance.save()
            else:
                SIONExportModel.objects.create(norm_class=instance, **item)

        # Import Norm
        import_data = validated_data.pop('import_norm', [])
        existing_ids = []
        for item in import_data:
            if 'id' in item:
                import_instance = SIONImportModel.objects.get(id=item['id'], norm_class=instance)
                for attr, value in item.items():
                    setattr(import_instance, attr, value)
                import_instance.save()
                existing_ids.append(item['id'])
            else:
                new = SIONImportModel.objects.create(norm_class=instance, **item)
                existing_ids.append(new.id)

        # Delete removed imports
        SIONImportModel.objects.filter(norm_class=instance).exclude(id__in=existing_ids).delete()

        return instance

    def create(self, validated_data):
        export_data = validated_data.pop('export_norm', [])
        import_data = validated_data.pop('import_norm', [])

        request = self.context.get('request')
        user = request.user if request else None

        # Create main norm class instance
        instance = SionNormClassModel.objects.create(
            norm_class=validated_data.get('norm_class'),
            description=validated_data.get('description'),
            head_norm=validated_data.get('head_norm', None),
            created_by=user,
            modified_by=user,
        )

        # Create Export norm(s)
        for item in export_data:
            SIONExportModel.objects.create(norm_class=instance, **item)

        # Create import norm(s)
        for item in import_data:
            SIONImportModel.objects.create(norm_class=instance, **item)

        return instance


class InvoiceEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceEntity
        fields = '__all__'
