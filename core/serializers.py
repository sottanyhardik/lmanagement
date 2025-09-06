import re
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
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


class Decimal2CoerceField(serializers.DecimalField):
    """
    DecimalField that:
      - treats None / "" as 0
      - rounds to the declared decimal_places (banker's safe)
      - never raises for 3+ decimals; it will round to 2 (or the set decimal_places)
    """

    def to_internal_value(self, value):
        if value in (None, ""):
            value = "0"
        value = str(value).strip()
        if value == "":
            value = "0"
        quant = Decimal(10) ** -self.decimal_places  # e.g. 2 -> Decimal('0.01')
        try:
            d = Decimal(value)
        except Exception:
            # fall back to parent for nice error messages
            return super().to_internal_value(value)
        # round safely to declared places (default: 2)
        d = d.quantize(quant, rounding=ROUND_HALF_UP)
        return d


# ---------- Child serializers ----------

class SIONImportSerializer(serializers.ModelSerializer):
    # make id writeable so updates don't create duplicates
    id = serializers.IntegerField(required=False)

    hsn_code = HSCodeSerializer(read_only=True)
    # accept PK for writes
    hsn_code_id = serializers.PrimaryKeyRelatedField(
        queryset=HSCodeModel.objects.all(),
        source='hsn_code',
        write_only=True,
        required=False,
        allow_null=True,
    )

    # coerce/round numbers
    quantity = Decimal2CoerceField(max_digits=20, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = SIONImportModel
        fields = [
            'id', 'sr_no', 'description', 'quantity', 'unit', 'condition',
            'hsn_code', 'hsn_code_id'
        ]


class SIONExportSerializer(serializers.ModelSerializer):
    # make id writeable so updates don't create duplicates
    id = serializers.IntegerField(required=False)
    quantity = Decimal2CoerceField(max_digits=20, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = SIONExportModel
        fields = ['id', 'description', 'quantity', 'unit']


class HeadSIONNormsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeadSIONNormsModel
        fields = ['id', 'name']


# ---------- Parent serializer with proper upsert ----------

class SionNormClassSerializer(serializers.ModelSerializer):
    head_norm = HeadSIONNormsSerializer(read_only=True)
    head_norm_id = serializers.PrimaryKeyRelatedField(
        queryset=HeadSIONNormsModel.objects.all(),
        source='head_norm',
        write_only=True,
        required=False,
        allow_null=True,
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

    # ---- Upsert helpers ----
    def _upsert_exports(self, instance, rows):
        existing = {str(obj.id): obj for obj in SIONExportModel.objects.filter(norm_class=instance)}
        seen_ids = set()

        for item in rows:
            pk = item.get('id')
            if pk:
                seen_ids.add(str(pk))
                obj = existing.get(str(pk))
                if not obj:
                    # if id sent but not found for this norm, treat as not found
                    raise serializers.ValidationError({'export_norm': [f'Export id {pk} not found.']})
                # update fields
                for k, v in item.items():
                    if k == 'id':
                        continue
                    setattr(obj, k, v)
                obj.save()
            else:
                SIONExportModel.objects.create(norm_class=instance, **item)

        # delete those missing from payload
        for eid, obj in existing.items():
            if eid not in seen_ids:
                obj.delete()

    def _upsert_imports(self, instance, rows):
        existing = {str(obj.id): obj for obj in SIONImportModel.objects.filter(norm_class=instance)}
        seen_ids = set()

        for item in rows:
            pk = item.get('id')
            if pk:
                seen_ids.add(str(pk))
                obj = existing.get(str(pk))
                if not obj:
                    raise serializers.ValidationError({'import_norm': [f'Import id {pk} not found.']})
                # update fields (hsn_code_id already mapped to hsn_code)
                for k, v in item.items():
                    if k == 'id':
                        continue
                    setattr(obj, k, v)
                obj.save()
            else:
                new = SIONImportModel.objects.create(norm_class=instance, **item)
                seen_ids.add(str(new.id))

        # delete those missing from payload
        for iid, obj in existing.items():
            if iid not in seen_ids:
                obj.delete()

    @transaction.atomic
    def create(self, validated_data):
        export_rows = validated_data.pop('export_norm', [])
        import_rows = validated_data.pop('import_norm', [])

        req = self.context.get('request')
        user = getattr(req, 'user', None)

        instance = SionNormClassModel.objects.create(
            norm_class=validated_data.get('norm_class', ''),
            description=validated_data.get('description', ''),
            head_norm=validated_data.get('head_norm', None),
            created_by=user,
            modified_by=user,
        )

        # create children
        for item in export_rows:
            SIONExportModel.objects.create(norm_class=instance, **item)
        for item in import_rows:
            SIONImportModel.objects.create(norm_class=instance, **item)

        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        # basic fields
        instance.norm_class = validated_data.get('norm_class', instance.norm_class)
        instance.description = validated_data.get('description', instance.description)
        if 'head_norm' in validated_data:
            instance.head_norm = validated_data.get('head_norm')
        req = self.context.get('request')
        if req and hasattr(req, 'user'):
            instance.modified_by = req.user
        instance.save()

        # children upserts
        export_rows = validated_data.pop('export_norm', None)
        import_rows = validated_data.pop('import_norm', None)

        if export_rows is not None:
            self._upsert_exports(instance, export_rows)
        if import_rows is not None:
            self._upsert_imports(instance, import_rows)

        return instance


class InvoiceEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceEntity
        fields = '__all__'
