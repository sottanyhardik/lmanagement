# allotment/serializers.py
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Set

from django.db import transaction
from rest_framework import serializers

from allotment.models import AllotmentModel, AllotmentItems
from core.models import CompanyModel, PortModel
from core.serializers import PortOptionSerializer, CompanyOptionSerializer
from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer


# ---- Mini serializers for related objects (read-only) ----

class CompanyMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyModel
        fields = ("id", "name")


class PortMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortModel
        fields = ("id", "name", "code")


# ---- Helpers ----

class FlexiblePKRelatedField(serializers.PrimaryKeyRelatedField):
    """
    Accepts either a raw PK (e.g., 123) or an object like {"id": 123} / {"value": 123}.
    Useful for react-select / async selects.
    """

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.get("id") or data.get("value")
        return super().to_internal_value(data)


# ---- Nested row serializer ----

class AllotmentItemSerializer(serializers.ModelSerializer):
    """
    Serializer for AllotmentItems.
    Write:
      - item_id (LicenseImportItemsModel PK) — also accepts {"id": ...}
      - qty, cif_fc, cif_inr, is_boe
    Read:
      - item (mini object) & projections for table rendering
    """
    id = serializers.IntegerField(required=False)

    # WRITE
    item_id = FlexiblePKRelatedField(
        queryset=LicenseImportItemsModel.objects.all(),
        source="item",
        write_only=True
    )

    # READ
    item = LicenseImportItemsSelectSerializer(read_only=True)
    item_label = serializers.SerializerMethodField(read_only=True)

    serial_number = serializers.IntegerField(source="item.serial_number", read_only=True)
    description = serializers.CharField(source="item.description", read_only=True)
    hs_code = serializers.CharField(source="item.hs_code.code", read_only=True)
    unit = serializers.CharField(source="item.unit", read_only=True)

    # License / Port context
    license_number = serializers.CharField(source="item.license.license_number", read_only=True)
    license_date = serializers.DateField(source="item.license.license_date", read_only=True)
    exporter_name = serializers.CharField(source="item.license.exporter.name", read_only=True)
    registration_number = serializers.CharField(source="item.license.registration_number", read_only=True)
    registration_date = serializers.DateField(source="item.license.registration_date", read_only=True)
    notification_number = serializers.CharField(source="item.license.notification_number", read_only=True)
    file_number = serializers.CharField(source="item.license.file_number", read_only=True)
    port_name = serializers.CharField(source="item.license.port.name", read_only=True)
    port_code = serializers.CharField(source="item.license.port.code", read_only=True)

    delete_url = serializers.CharField(source="get_delete_url", read_only=True)

    class Meta:
        model = AllotmentItems
        fields = (
            "id",
            "item_id",  # write-only
            "item",  # read-only mini
            "item_label",  # read-only label for UI

            "qty",
            "cif_fc",
            "cif_inr",
            "is_boe",

            # projections
            "serial_number",
            "description",
            "hs_code",
            "unit",
            "license_number",
            "license_date",
            "exporter_name",
            "registration_number",
            "registration_date",
            "notification_number",
            "file_number",
            "port_name",
            "port_code",
            "delete_url",
        )

    def get_item_label(self, obj):
        i = obj.item
        if not i:
            return None
        hs = getattr(i.hs_code, "code", "") or ""
        parts = [f"S{getattr(i, 'serial_number', '')}".strip()]
        if hs:
            parts.append(hs)
        if i.description:
            parts.append(i.description)
        return " • ".join([p for p in parts if p])

    # Row-level validation
    def validate(self, attrs):
        item = attrs.get("item") or getattr(self.instance, "item", None)
        qty = attrs.get("qty", getattr(self.instance, "qty", 0)) or 0
        cif_fc = attrs.get("cif_fc", getattr(self.instance, "cif_fc", 0)) or 0
        cif_inr = attrs.get("cif_inr", getattr(self.instance, "cif_inr", 0)) or 0

        # qty > 0
        try:
            if float(qty) <= 0:
                raise serializers.ValidationError({"qty": "Quantity must be greater than 0."})
        except (TypeError, ValueError):
            raise serializers.ValidationError({"qty": "Quantity must be a number."})

        # cif values ≥ 0
        try:
            if float(cif_fc) < 0:
                raise serializers.ValidationError({"cif_fc": "Must be ≥ 0."})
            if float(cif_inr) < 0:
                raise serializers.ValidationError({"cif_inr": "Must be ≥ 0."})
        except (TypeError, ValueError):
            raise serializers.ValidationError({"_error": "Invalid numeric values for CIF amounts."})

        # qty <= available + existing_row_qty (for updates)
        if item:
            available = float((item.available_quantity or Decimal("0")))
            existing_row_qty = float(getattr(self.instance, "qty", 0)) if self.instance else 0.0
            if float(qty) > available + existing_row_qty:
                raise serializers.ValidationError({
                    "qty": f"Quantity exceeds available ({available})."
                })

        return attrs


# ---- Parent serializer ----

class AllotmentSerializer(serializers.ModelSerializer):
    """
    Serializer for AllotmentModel with nested details:
      - company/port/related_company via *_id fields for write, mini serializers for read
      - nested allotment_details upsert by id; deletes missing rows on update
      - exposes computed properties from the model
    """
    # Relations (read)
    company = CompanyMiniSerializer(read_only=True)
    port = PortMiniSerializer(read_only=True)
    related_company = CompanyMiniSerializer(read_only=True)

    # Relations (write)
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=CompanyModel.objects.all(),
        source="company",
        write_only=True
    )
    port_id = serializers.PrimaryKeyRelatedField(
        queryset=PortModel.objects.all(),
        source="port",
        write_only=True,
        required=False,
        allow_null=True,
    )
    related_company_id = serializers.PrimaryKeyRelatedField(
        queryset=CompanyModel.objects.all(),
        source="related_company",
        write_only=True,
        required=False,
        allow_null=True,
    )

    # Nested
    allotment_details = AllotmentItemSerializer(many=True, required=False)

    # Computed from model (@cached_property)
    required_value = serializers.IntegerField(read_only=True)
    dfia_list = serializers.CharField(read_only=True)
    balanced_quantity = serializers.IntegerField(read_only=True)
    alloted_quantity = serializers.IntegerField(read_only=True)  # model has one 't'
    allotted_value = serializers.IntegerField(read_only=True)  # model uses two 't' here

    class Meta:
        model = AllotmentModel
        fields = (
            "id",
            "company", "company_id",
            "type",
            "required_quantity",
            "unit_value_per_unit",
            "item_name",
            "contact_person",
            "contact_number",
            "invoice",
            "estimated_arrival_date",
            "bl_detail",
            "port", "port_id",
            "related_company", "related_company_id",

            # computed
            "required_value",
            "dfia_list",
            "balanced_quantity",
            "alloted_quantity",
            "allotted_value",

            # nested
            "allotment_details",
        )
        read_only_fields = (
            "company",
            "port",
            "related_company",
            "required_value",
            "dfia_list",
            "balanced_quantity",
            "alloted_quantity",
            "allotted_value",
        )

    # ---- Parent-level validation ----
    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        # Basic numeric guards
        rq = attrs.get("required_quantity", getattr(self.instance, "required_quantity", 0))
        uv = attrs.get("unit_value_per_unit", getattr(self.instance, "unit_value_per_unit", 0))
        try:
            if float(rq) < 0:
                raise serializers.ValidationError({"required_quantity": "Must be ≥ 0."})
            if float(uv) < 0:
                raise serializers.ValidationError({"unit_value_per_unit": "Must be ≥ 0."})
        except (TypeError, ValueError):
            raise serializers.ValidationError({"_error": "Numeric fields contain invalid values."})

        # Duplicate item guard within payload (prevents unique_together errors)
        details = attrs.get("allotment_details", None)
        if details:
            seen: Set[int] = set()
            dups: Set[int] = set()
            for d in details:
                item = d.get("item")
                if item:
                    if item.id in seen:
                        dups.add(item.id)
                    seen.add(item.id)
            if dups:
                raise serializers.ValidationError({
                    "allotment_details": f"Duplicate items in payload: {sorted(list(dups))}"
                })

        return attrs

    # ---- Create/Update with nested details ----
    @transaction.atomic
    def create(self, validated_data: Dict[str, Any]) -> AllotmentModel:
        details_data = validated_data.pop("allotment_details", [])
        allotment = AllotmentModel.objects.create(**validated_data)
        for d in details_data:
            AllotmentItems.objects.create(allotment=allotment, **d)
        return allotment

    @transaction.atomic
    def update(self, instance: AllotmentModel, validated_data: Dict[str, Any]) -> AllotmentModel:
        details_data = validated_data.pop("allotment_details", None)

        # Update scalar fields/relations
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if details_data is not None:
            # Upsert by id; delete those omitted
            existing_by_id: Dict[int, AllotmentItems] = {
                obj.id: obj for obj in instance.allotment_details.all()
            }
            valid_ids = set(existing_by_id.keys())

            seen_ids: Set[int] = set()
            for d in details_data:
                row_id = d.get("id", None)
                item_obj = d.get("item")  # resolved by item_id field

                if row_id:
                    if row_id not in valid_ids:
                        raise serializers.ValidationError(
                            {"allotment_details": f"Row id {row_id} does not belong to this allotment."}
                        )
                    obj = existing_by_id[row_id]
                    if item_obj is not None:
                        obj.item = item_obj
                    if "qty" in d:
                        obj.qty = d["qty"]
                    if "cif_fc" in d:
                        obj.cif_fc = d["cif_fc"]
                    if "cif_inr" in d:
                        obj.cif_inr = d["cif_inr"]
                    if "is_boe" in d:
                        obj.is_boe = d["is_boe"]
                    obj.save()
                    seen_ids.add(row_id)
                else:
                    created = AllotmentItems.objects.create(allotment=instance, **d)
                    seen_ids.add(created.id)

            # Delete rows not present in payload
            for obj_id, obj in existing_by_id.items():
                if obj_id not in seen_ids:
                    obj.delete()

        return instance


# ---- Light list/option serializer (for dropdowns, etc.) ----

class AllotmentOptionSerializer(serializers.ModelSerializer):
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()
    item_details = AllotmentItemSerializer(source="allotment_details", many=True)

    class Meta:
        model = AllotmentModel
        fields = ["id", "company", "port", "required_quantity", "invoice", "item_name", "item_details"]
