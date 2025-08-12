# allotment/serializers.py
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Set, Tuple

from django.db import transaction
from rest_framework import serializers

from allotment.models import AllotmentModel, AllotmentItems
from core.models import CompanyModel, PortModel
from core.serializers import PortOptionSerializer, CompanyOptionSerializer
from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer


# -------------------------
# Utilities
# -------------------------
def d2(x) -> Decimal:
    """Safely coerce to Decimal with 2 dp."""
    if x is None:
        x = 0
    if not isinstance(x, Decimal):
        x = Decimal(str(x))
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# -------------------------
# Mini serializers (read-only)
# -------------------------
class CompanyMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyModel
        fields = ("id", "name")


class PortMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortModel
        fields = ("id", "name", "code")


# -------------------------
# Helpers
# -------------------------
class FlexiblePKRelatedField(serializers.PrimaryKeyRelatedField):
    """
    Accept either a PK (123) or an object like {"id": 123} / {"value": 123}.
    """

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.get("id") or data.get("value")
        return super().to_internal_value(data)


# -------------------------
# Allotment Detail (row) serializer
# -------------------------
class AllotmentItemSerializer(serializers.ModelSerializer):
    """
    Write:
      - item_id (LicenseImportItemsModel PK) — also accepts {"id": ...}
      - qty, cif_fc, cif_inr, is_boe
    Read:
      - item (mini) + projections for table rendering + delete_url
    """
    id = serializers.IntegerField(required=False)

    # WRITE
    item_id = FlexiblePKRelatedField(
        queryset=LicenseImportItemsModel.objects.all(),
        source="item",
        write_only=True,
        required=False,  # allow partial updates on nested rows
    )

    # READ
    item = LicenseImportItemsSelectSerializer(read_only=True)
    item_label = serializers.SerializerMethodField(read_only=True)
    delete_url = serializers.SerializerMethodField(read_only=True)

    # Projections
    serial_number = serializers.IntegerField(source="item.serial_number", read_only=True)
    description = serializers.CharField(source="item.description", read_only=True)
    hs_code = serializers.CharField(source="item.hs_code.code", read_only=True)
    unit = serializers.CharField(source="item.unit", read_only=True)

    # License context
    license_number = serializers.CharField(source="item.license.license_number", read_only=True)
    license_date = serializers.DateField(source="item.license.license_date", read_only=True)
    exporter_name = serializers.CharField(source="item.license.exporter.name", read_only=True)
    registration_number = serializers.CharField(source="item.license.registration_number", read_only=True)
    registration_date = serializers.DateField(source="item.license.registration_date", read_only=True)
    notification_number = serializers.CharField(source="item.license.notification_number", read_only=True)
    file_number = serializers.CharField(source="item.license.file_number", read_only=True)
    port_name = serializers.CharField(source="item.license.port.name", read_only=True)
    port_code = serializers.CharField(source="item.license.port.code", read_only=True)

    class Meta:
        model = AllotmentItems
        fields = (
            "id",
            # write-only
            "item_id",
            # read-only
            "item",
            "item_label",
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

    def get_delete_url(self, obj):
        # We expose a predictable path that matches AllotmentViewSet.delete_detail action.
        return f"/api/allotments/{obj.allotment_id}/details/{obj.id}/"

    # Row-level validation (caps against item's availability including self on update)
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

        if item:
            # When updating an existing row, the "available" effectively includes this row’s current qty/value.
            existing_qty = float(getattr(self.instance, "qty", 0)) if self.instance else 0.0
            existing_val = float(getattr(self.instance, "cif_fc", 0)) if self.instance else 0.0

            available_qty = float(item.available_quantity or 0) + existing_qty
            available_val = float(item.available_value or 0) + existing_val

            if float(qty) > available_qty:
                raise serializers.ValidationError({"qty": f"Quantity exceeds available ({available_qty})."})
            if float(cif_fc) > available_val:
                raise serializers.ValidationError({"cif_fc": f"Value exceeds available (${available_val})."})

        return attrs


# -------------------------
# Allotment (parent) serializer
# -------------------------
class AllotmentSerializer(serializers.ModelSerializer):
    """
    - company/port via *_id for write, mini serializers for read
    - nested allotment_details upsert-by-id; deletes missing rows
    - automatically keeps LicenseImportItemsModel availability/allotted in sync (delta-based)
    """
    # Relations (read)
    company = CompanyMiniSerializer(read_only=True)
    port = PortMiniSerializer(read_only=True)

    # Relations (write)
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=CompanyModel.objects.all(), source="company", write_only=True
    )
    port_id = serializers.PrimaryKeyRelatedField(
        queryset=PortModel.objects.all(), source="port", write_only=True, required=False, allow_null=True
    )

    # Nested
    allotment_details = AllotmentItemSerializer(many=True, required=False)

    # Computed from model (@cached_property on model)
    required_value = serializers.IntegerField(read_only=True)  # required_quantity * unit_value_per_unit
    dfia_list = serializers.CharField(read_only=True)
    balanced_quantity = serializers.IntegerField(read_only=True)
    alloted_quantity = serializers.IntegerField(read_only=True)  # model uses one 't'
    allotted_value = serializers.IntegerField(read_only=True)  # here two 't' per model field

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
            "exchange_rate",
            "required_cif_inr",
            "required_cif_fc",
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
            "required_value",
            "dfia_list",
            "balanced_quantity",
            "alloted_quantity",
            "allotted_value",
        )

    # ------------- parent validation -------------
    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        errors: Dict[str, Any] = {}

        def to_float(v, default=None):
            if v is None:
                return default
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        rq = attrs.get("required_quantity", getattr(self.instance, "required_quantity", 0))
        uv = attrs.get("unit_value_per_unit", getattr(self.instance, "unit_value_per_unit", 0))
        rate = attrs.get("exchange_rate", getattr(self.instance, "exchange_rate", 0))
        cif_inr = attrs.get("required_cif_inr", getattr(self.instance, "required_cif_inr", 0))
        cif_fc = attrs.get("required_cif_fc", getattr(self.instance, "required_cif_fc", 0))

        rq_f = to_float(rq, 0)
        uv_f = to_float(uv, 0)
        rate_f = to_float(rate, 0)
        cif_inr_f = to_float(cif_inr, 0)
        cif_fc_f = to_float(cif_fc, 0)

        # basic guards
        if rq_f is None or rq_f < 0:
            errors["required_quantity"] = "Must be ≥ 0."
        if uv_f is None or uv_f < 0:
            errors["unit_value_per_unit"] = "Must be ≥ 0."

        # If any CIF provided, require exchange rate
        if ((cif_inr_f or 0) > 0 or (cif_fc_f or 0) > 0) and (not rate_f or rate_f <= 0):
            errors["exchange_rate"] = "Exchange rate (₹ per $) is required and must be > 0 when CIF is provided."

        if errors:
            raise serializers.ValidationError(errors)

        # Auto-sync CIF INR/$ if one missing and exchange rate is known
        if rate_f and rate_f > 0:
            if (cif_fc_f or 0) > 0 and (not cif_inr or (cif_inr_f or 0) == 0):
                attrs["required_cif_inr"] = cif_fc_f * rate_f
                cif_inr_f = attrs["required_cif_inr"]
            elif (cif_inr_f or 0) > 0 and (not cif_fc or (cif_fc_f or 0) == 0):
                attrs["required_cif_fc"] = cif_inr_f / rate_f
                cif_fc_f = attrs["required_cif_fc"]

        # Auto-compute unit_value_per_unit if possible
        if rq_f and rq_f > 0 and (cif_fc_f or 0) > 0:
            if "unit_value_per_unit" not in attrs or not uv_f:
                attrs["unit_value_per_unit"] = cif_fc_f / rq_f

        # Duplicate item guard within payload
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

    # ----------------- Inventory adjustment helpers -----------------
    def _apply_item_delta(self, item: LicenseImportItemsModel, delta_qty: Decimal, delta_fc: Decimal):
        """
        Apply deltas to a LicenseImportItemsModel:
          available -= delta, allotted += delta
        Positive delta means consuming availability; negative releases back.
        """
        item.refresh_from_db(fields=["available_quantity", "available_value", "allotted_quantity", "allotted_value"])

        avail_qty = d2(item.available_quantity or 0)
        avail_val = d2(item.available_value or 0)
        all_q = d2(item.allotted_quantity or 0)
        all_v = d2(item.allotted_value or 0)

        # For positive deltas, ensure we don't go below zero availability
        if delta_qty > 0 and avail_qty < delta_qty:
            raise serializers.ValidationError({"allotment_details": f"Insufficient available qty for item {item.pk}."})
        if delta_fc > 0 and avail_val < delta_fc:
            raise serializers.ValidationError({"allotment_details": f"Insufficient available $ for item {item.pk}."})

        new_avail_qty = avail_qty - delta_qty
        new_avail_val = avail_val - delta_fc
        new_all_q = all_q + delta_qty
        new_all_v = all_v + delta_fc

        # Prevent negatives due to rounding/edge conditions
        if new_avail_qty < 0 or new_avail_val < 0:
            raise serializers.ValidationError(
                {"allotment_details": f"Allocation would drive availability below zero for item {item.pk}."})
        if new_all_q < 0 or new_all_v < 0:
            raise serializers.ValidationError(
                {"allotment_details": f"Allocation would drive allotted fields below zero for item {item.pk}."})

        item.available_quantity = d2(new_avail_qty)
        item.available_value = d2(new_avail_val)
        item.allotted_quantity = d2(new_all_q)
        item.allotted_value = d2(new_all_v)
        item.save(update_fields=["available_quantity", "available_value", "allotted_quantity", "allotted_value"])

    def _diff_existing_vs_payload(
            self,
            instance: AllotmentModel,
            details_data: list[dict],
    ) -> Tuple[list[Tuple[AllotmentItems, dict]], list[dict], list[AllotmentItems]]:
        """
        Returns (updates, creates, deletes)
          updates: list of (existing_obj, incoming_row_dict)
          creates: list of incoming_row_dict (no id)
          deletes: list of existing_obj that are missing in payload
        """
        existing_by_id: Dict[int, AllotmentItems] = {obj.id: obj for obj in
                                                     instance.allotment_details.select_related("item")}
        incoming_ids: Set[int] = set()
        updates: list[Tuple[AllotmentItems, dict]] = []
        creates: list[dict] = []

        for d in details_data:
            row_id = d.get("id")
            if row_id:
                incoming_ids.add(row_id)
                if row_id not in existing_by_id:
                    raise serializers.ValidationError(
                        {"allotment_details": f"Row id {row_id} does not belong to this allotment."})
                updates.append((existing_by_id[row_id], d))
            else:
                creates.append(d)

        deletes = [obj for obj_id, obj in existing_by_id.items() if obj_id not in incoming_ids]
        return updates, creates, deletes

    # ----------------- Create / Update -----------------
    @transaction.atomic
    def create(self, validated_data: Dict[str, Any]) -> AllotmentModel:
        details_data = validated_data.pop("allotment_details", [])
        allotment = AllotmentModel.objects.create(**validated_data)

        # Create details + apply deltas
        for d in details_data:
            item: LicenseImportItemsModel = d["item"]
            qty = d2(d.get("qty", 0))
            val = d2(d.get("cif_fc", 0))
            # consume availability
            item = LicenseImportItemsModel.objects.select_for_update().get(pk=item.pk)
            self._apply_item_delta(item, qty, val)
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
            updates, creates, deletes = self._diff_existing_vs_payload(instance, details_data)

            # 1) Deletes: release availability back
            for obj in deletes:
                item = LicenseImportItemsModel.objects.select_for_update().get(pk=obj.item_id)
                self._apply_item_delta(item, d2(0) - d2(obj.qty or 0), d2(0) - d2(obj.cif_fc or 0))
                obj.delete()

            # 2) Updates: compute delta and apply
            for obj, d in updates:
                old_item_id = obj.item_id
                old_qty = d2(obj.qty or 0)
                old_val = d2(obj.cif_fc or 0)

                new_item: LicenseImportItemsModel = d.get("item") or obj.item
                new_qty = d2(d.get("qty", obj.qty))
                new_val = d2(d.get("cif_fc", obj.cif_fc))

                if new_item.id == old_item_id:
                    # same item → only delta qty/value
                    delta_q = new_qty - old_qty
                    delta_v = new_val - old_val
                    if delta_q != 0 or delta_v != 0:
                        item = LicenseImportItemsModel.objects.select_for_update().get(pk=new_item.pk)
                        self._apply_item_delta(item, delta_q, delta_v)
                else:
                    # item changed → revert old, apply new
                    old_item = LicenseImportItemsModel.objects.select_for_update().get(pk=old_item_id)
                    self._apply_item_delta(old_item, d2(0) - old_qty, d2(0) - old_val)

                    new_item_locked = LicenseImportItemsModel.objects.select_for_update().get(pk=new_item.pk)
                    self._apply_item_delta(new_item_locked, new_qty, new_val)

                # finally persist the row
                obj.item = new_item
                obj.qty = new_qty
                obj.cif_fc = new_val
                if "cif_inr" in d:
                    obj.cif_inr = d2(d.get("cif_inr"))
                if "is_boe" in d:
                    obj.is_boe = bool(d.get("is_boe"))
                obj.save()

            # 3) Creates: consume availability and insert rows
            for d in creates:
                item: LicenseImportItemsModel = d["item"]
                qty = d2(d.get("qty", 0))
                val = d2(d.get("cif_fc", 0))
                item_locked = LicenseImportItemsModel.objects.select_for_update().get(pk=item.pk)
                self._apply_item_delta(item_locked, qty, val)
                AllotmentItems.objects.create(allotment=instance, **d)

        return instance


# -------------------------
# Lightweight options (for select dropdowns)
# -------------------------
class AllotmentOptionSerializer(serializers.ModelSerializer):
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()
    item_details = AllotmentItemSerializer(source="allotment_details", many=True)

    class Meta:
        model = AllotmentModel
        fields = [
            "id",
            "company",
            "port",
            "required_quantity",
            "invoice",
            "item_name",
            "exchange_rate",
            "required_cif_inr",
            "required_cif_fc",
            "item_details",
        ]


# -------------------------
# Minimal create-one-detail serializer (used by POST /api/allotments/{id}/details/)
# We keep this here for import convenience in the ViewSet action.
# -------------------------
class AllotmentItemCreateSerializer(serializers.Serializer):
    """
    POST fields:
      - item_id (LicenseImportItemsModel PK)
      - qty
      - cif_fc (optional)
      - cif_inr (optional)
      - is_boe (optional, default False)
    """
    item_id = serializers.PrimaryKeyRelatedField(
        queryset=LicenseImportItemsModel.objects.all(), source="item"
    )
    qty = serializers.DecimalField(max_digits=15, decimal_places=2)
    cif_fc = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, default=0)
    cif_inr = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, default=0)
    is_boe = serializers.BooleanField(required=False, default=False)

    def create(self, validated_data):
        allotment = self.context["allotment"]
        # Note: the ViewSet action wraps this and applies availability deltas.
        return AllotmentItems.objects.create(allotment=allotment, **validated_data)
