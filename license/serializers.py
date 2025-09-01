from django.db import transaction
from django.db.models.deletion import ProtectedError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from core.models import HSCodeModel, ItemNameModel, CompanyModel, PortModel, SionNormClassModel
from core.serializers import HSCodeSerializer, ItemNameSerializer, CompanySerializer, PortSerializer, \
    SionNormClassSerializer
from license.models import LicenseExportItemModel, LicenseImportItemsModel
from .models import LicenseDetailsModel
from .models import LicensePurchase
from .utils import safe_get


class LicenseImportItemsSelectSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    hs_code = serializers.CharField(source="hs_code.hs_code", read_only=True)
    license_number = serializers.CharField(source="license.license_number", read_only=True)
    notification_number = serializers.CharField(source="license.notification_number", read_only=True)

    class Meta:
        model = LicenseImportItemsModel
        fields = (
            "id",
            "display_name",
            "serial_number",
            "description",
            "available_quantity",
            "available_value",
            "hs_code",
            "license_number",
            "notification_number",
        )

    def get_display_name(self, obj):
        parts = [f"LIC {obj.license.license_number}", f"SR {obj.serial_number}"]
        return " • ".join(parts)


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
    debited_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    debited_value = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    allotted_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    allotted_value = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    available_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)

    class Meta:
        model = LicenseImportItemsModel
        fields = [
            'id', 'serial_number', 'description', 'quantity', 'unit', 'cif_fc', 'cif_inr', 'hs_code', 'hs_code_id',
            'items', 'items_ids', 'debited_quantity', 'debited_value', 'allotted_quantity', 'allotted_value',
            'available_quantity'
        ]


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

        # Export items
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

        # Upsert Export items
        if export_items_data is not None:
            self._upsert_export_items(instance, export_items_data)

        # Upsert import items
        if import_items_data is not None:
            self._upsert_import_items(instance, import_items_data)

        return instance


class BiscuitReportSerializer(serializers.ModelSerializer):
    exporter_name = serializers.CharField(source="exporter.name", read_only=True)
    norm_class = serializers.CharField(source="export_license.norm_class.norm_class", read_only=True)

    # Vegetable Oils
    veg_oil_hsn = serializers.SerializerMethodField()
    veg_oil_pd = serializers.SerializerMethodField()
    total_veg_qty = serializers.SerializerMethodField()
    rbd_qty = serializers.SerializerMethodField()
    rbd_cif = serializers.SerializerMethodField()
    pko_qty = serializers.SerializerMethodField()
    pko_cif = serializers.SerializerMethodField()
    veg_qty = serializers.SerializerMethodField()
    veg_cif = serializers.SerializerMethodField()
    pomace_qty = serializers.SerializerMethodField()
    pomace_cif = serializers.SerializerMethodField()
    ten_restriction = serializers.SerializerMethodField()

    # Juice
    juice_hsn = serializers.SerializerMethodField()
    juice_pd = serializers.SerializerMethodField()
    juice_qty = serializers.SerializerMethodField()
    juice_cif = serializers.SerializerMethodField()

    # Food flavour & dietary
    ff_hsn = serializers.SerializerMethodField()
    ff_pd = serializers.SerializerMethodField()
    ff_qty = serializers.SerializerMethodField()
    df_qty = serializers.SerializerMethodField()
    f_f_qty = serializers.SerializerMethodField()
    f_f_cif = serializers.SerializerMethodField()
    la_qty = serializers.SerializerMethodField()
    starch_1108 = serializers.SerializerMethodField()
    starch__1108_cif = serializers.SerializerMethodField()
    starch_3505 = serializers.SerializerMethodField()

    # Milk, cheese, whey, protein
    mnm_pd = serializers.SerializerMethodField()
    mnm_qty = serializers.SerializerMethodField()
    cheese_qty = serializers.SerializerMethodField()
    cheese_cif = serializers.SerializerMethodField()
    swp_qty = serializers.SerializerMethodField()
    swp_cif = serializers.SerializerMethodField()
    wpc_qty = serializers.SerializerMethodField()
    wpc_cif = serializers.SerializerMethodField()

    # PP & aluminium
    pp_hsn = serializers.SerializerMethodField()
    pp_pd = serializers.SerializerMethodField()
    pp_qty = serializers.SerializerMethodField()
    get_aluminium = serializers.SerializerMethodField()

    # Wastage balance
    balance_cif_value = serializers.SerializerMethodField()

    class Meta:
        model = LicenseDetailsModel
        fields = [
            "id", "license_number", "license_expiry_date",
            "exporter_name", "norm_class", 'balance_cif',

            # veg oils
            "veg_oil_hsn", "veg_oil_pd", "total_veg_qty",
            "rbd_qty", "rbd_cif",
            "pko_qty", "pko_cif",
            "veg_qty", "veg_cif",
            "pomace_qty", "pomace_cif",
            "ten_restriction",

            # juice
            "juice_hsn", "juice_pd", "juice_qty", "juice_cif",

            # food flavour etc
            "ff_hsn", "ff_pd", "ff_qty",
            "df_qty", "f_f_qty", "f_f_cif",

            # starch & leavening
            "la_qty", "starch_1108", "starch__1108_cif", "starch_3505",

            # milk/cheese/whey
            "mnm_pd", "mnm_qty",
            "cheese_qty", "cheese_cif",
            "swp_qty", "swp_cif",
            "wpc_qty", "wpc_cif",

            # pp / aluminium
            "pp_hsn", "pp_pd", "pp_qty",
            "get_aluminium",

            # balance
            "balance_cif_value",
        ]

    # -------------------
    # 🔹 Implementations
    # -------------------
    # --- Vegetable Oils ---
    def get_veg_oil_hsn(self, obj):
        oil_qs = safe_get(obj, "oil_queryset")
        return safe_get(oil_qs, "hs_code__hs_code")

    def get_veg_oil_pd(self, obj):
        oil_qs = safe_get(obj, "oil_queryset")
        return safe_get(oil_qs, "description")

    def get_total_veg_qty(self, obj):
        oil_qs = safe_get(obj, "oil_queryset")
        return safe_get(oil_qs, "available_quantity_sum")

    def get_rbd_qty(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "rbd_oil", 0)

    def get_rbd_cif(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "cif_rbd_oil", 0)

    def get_pko_qty(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "pko_oil", 0)

    def get_pko_cif(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "cif_pko_oil", 0)

    def get_veg_qty(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "olive_oil", 0)

    def get_veg_cif(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "cif_olive_oil", 0)

    def get_pomace_qty(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "pomace_oil", 0)

    def get_pomace_cif(self, obj):
        veg_oil = safe_get(obj.cif_value_balance_biscuits, "veg_oil", {})
        return safe_get(veg_oil, "cif_pomace_oil", 0)

    def get_ten_restriction(self, obj):
        per_cif = safe_get(obj, "get_per_cif")
        return safe_get(per_cif, "tenRestriction")

    # --- Juice ---
    def get_juice_hsn(self, obj):
        juice = safe_get(obj, "get_biscuit_juice")
        return safe_get(juice, "hs_code__hs_code")

    def get_juice_pd(self, obj):
        juice = safe_get(obj, "get_biscuit_juice")
        return safe_get(juice, "description")

    def get_juice_qty(self, obj):
        juice = safe_get(obj, "get_biscuit_juice")
        return safe_get(juice, "available_quantity_sum")

    def get_juice_cif(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "cif_juice", 0)

    # --- Food flavour & dietary ---
    def get_ff_hsn(self, obj):
        ff = safe_get(obj, "get_food_flavour")
        return safe_get(ff, "hs_code__hs_code")

    def get_ff_pd(self, obj):
        ff = safe_get(obj, "get_food_flavour")
        return safe_get(ff, "description")

    def get_ff_qty(self, obj):
        ff = safe_get(obj, "get_food_flavour")
        return safe_get(ff, "available_quantity_sum")

    def get_df_qty(self, obj):
        df = safe_get(obj, "get_dietary_fibre")
        return safe_get(df, "available_quantity_sum")

    def get_f_f_qty(self, obj):
        fruit = safe_get(obj, "get_fruit")
        return safe_get(fruit, "available_quantity_sum")

    def get_f_f_cif(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "f_f_cif", 0)

    # --- Starch & Leavening ---
    def get_la_qty(self, obj):
        la = safe_get(obj, "get_leavening_agent")
        return safe_get(la, "available_quantity_sum")

    def get_starch_1108(self, obj):
        starch = safe_get(obj, "get_wheat_starch")
        return safe_get(starch, "available_quantity_sum")

    def get_starch__1108_cif(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "wheat_starch_cif", 0)

    def get_starch_3505(self, obj):
        starch = safe_get(obj, "get_modified_starch")
        return safe_get(starch, "available_quantity_sum")

    # --- Milk, cheese, whey, protein ---
    def get_mnm_pd(self, obj):
        mnm = safe_get(obj, "get_mnm_pd")
        return safe_get(mnm, "description")

    def get_mnm_qty(self, obj):
        mnm = safe_get(obj, "get_mnm_pd")
        return safe_get(mnm, "available_quantity_sum")

    def get_cheese_qty(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "qty_cheese", 0)

    def get_cheese_cif(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "cif_cheese", 0)

    def get_swp_qty(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "qty_swp", 0)

    def get_swp_cif(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "cif_swp", 0)

    def get_wpc_qty(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "qty_wpc", 0)

    def get_wpc_cif(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "cif_wpc", 0)

    # --- PP & Aluminium ---
    def get_pp_hsn(self, obj):
        pp = safe_get(obj, "get_pp")
        return safe_get(pp, "hs_code__hs_code")

    def get_pp_pd(self, obj):
        pp = safe_get(obj, "get_pp")
        return safe_get(pp, "description")

    def get_pp_qty(self, obj):
        pp = safe_get(obj, "get_pp")
        return safe_get(pp, "available_quantity_sum")

    def get_get_aluminium(self, obj):
        alu = safe_get(obj, "get_aluminium")
        return safe_get(alu, "available_quantity_sum")

    # --- Balance ---
    def get_balance_cif_value(self, obj):
        return safe_get(obj.cif_value_balance_biscuits, "available_value", 0)


ROUND2 = lambda x: round(float(x), 2)
ROUND3 = lambda x: round(float(x), 3)


class LicensePurchaseSerializer(serializers.ModelSerializer):
    # FE may send bill; BE derives markup_pct OR vice-versa
    bill_amount = serializers.FloatField(write_only=True, required=False)

    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    purchasing_entity_name = serializers.CharField(source="purchasing_entity.name", read_only=True)
    invoice_copy_url = serializers.SerializerMethodField()

    class Meta:
        model = LicensePurchase
        fields = [
            "id", "license",
            "purchasing_entity", "purchasing_entity_name",
            "supplier", "supplier_name",
            "supplier_pan", "supplier_gst",
            "invoice_number", "invoice_date", "invoice_copy", "invoice_copy_url",
            "mode", "amount_source",
            "fob_inr", "cif_inr", "cif_usd", "exchange_rate",
            "markup_pct", "bill_amount",  # write: bill_amount; read: markup_pct
            "product_name", "quantity_kg", "rate_inr",
            "amount_inr",  # computed, read-only to clients
            "created_on", "modified_on",
        ]
        read_only_fields = [
            "id", "amount_inr", "created_on", "modified_on",
            "supplier_name", "purchasing_entity_name", "invoice_copy_url"
        ]

    # ---------- helpers ----------
    def get_invoice_copy_url(self, obj):
        f = obj.invoice_copy
        if not f:
            return None
        try:
            url = f.url
        except Exception:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    @staticmethod
    def _to_float(val, default=0.0):
        try:
            if val in (None, ""):
                return default
            return float(val)
        except (TypeError, ValueError):
            return default

    def _pick(self, data, name, default=0.0):
        """Pick from incoming data or fall back to instance on PATCH."""
        if name in data:
            return self._to_float(data.get(name), default)
        if getattr(self, "instance", None) is not None:
            return self._to_float(getattr(self.instance, name, default), default)
        return default

    # ---------- core derivation ----------
    def _apply_derived_fields(self, data):
        """
        Rules (Amount mode):
          - bill_amount = source_amt * (markup_pct / 100)      # NO additional base
          - source ∈ {FOB_INR, CIF_INR, CIF_USD} (USD is taken as-is; no FX multiply)
          - If bill provided -> derive markup_pct (3 d.p.)
          - If markup_pct provided -> derive bill (2 d.p.)
          - exchange_rate auto = round(CIF_INR / CIF_USD, 3) when both are present & ER not supplied

        Qty mode:
          - amount_inr = quantity_kg * rate_inr  (2 d.p.)
        """
        mode = data.get("mode") or getattr(self.instance, "mode", LicensePurchase.MODE_AMOUNT)

        # Normalize/auto exchange rate if possible (helps UI; not used for bill math)
        cif_inr = self._pick(data, "cif_inr")
        cif_usd = self._pick(data, "cif_usd")
        ex_raw = data.get("exchange_rate", getattr(self.instance, "exchange_rate", None))
        if (ex_raw in (None, "", 0, 0.0)) and cif_inr > 0 and cif_usd > 0:
            data["exchange_rate"] = ROUND3(cif_inr / cif_usd)
        elif ex_raw not in (None, ""):
            data["exchange_rate"] = ROUND3(self._to_float(ex_raw))

        # Prepare a computed bucket to carry server-calculated amount to create/update
        data["_computed_amount_inr"] = None

        if mode == LicensePurchase.MODE_AMOUNT:
            amount_source = data.get("amount_source") or getattr(
                self.instance, "amount_source", LicensePurchase.SRC_FOB_INR
            )

            # choose the source (NO FX for USD)
            if amount_source == LicensePurchase.SRC_FOB_INR:
                source_amt = self._pick(data, "fob_inr")
            elif amount_source == LicensePurchase.SRC_CIF_INR:
                source_amt = self._pick(data, "cif_inr")
            else:  # LicensePurchase.SRC_CIF_USD
                source_amt = self._pick(data, "cif_usd")

            # normalize incoming
            bill_in = data.get("bill_amount", None)
            pct_in = data.get("markup_pct", None)
            bill = self._to_float(bill_in, None) if bill_in not in (None, "") else None
            pct = self._to_float(pct_in, None) if pct_in not in (None, "") else None

            if source_amt > 0:
                if bill is not None:
                    # back-solve rate%
                    pct = (bill / source_amt) * 100.0
                    data["markup_pct"] = ROUND3(pct)
                    data["bill_amount"] = ROUND2(bill)
                    data["_computed_amount_inr"] = ROUND2(bill)
                elif pct is not None:
                    # forward-solve bill
                    bill = source_amt * (pct / 100.0)
                    data["bill_amount"] = ROUND2(bill)
                    data["markup_pct"] = ROUND3(pct)
                    data["_computed_amount_inr"] = ROUND2(bill)
                # else: neither bill nor pct — leave as-is (could be updated later)
            # If source is zero/missing, nothing derivable; leave fields untouched.

        else:  # LicensePurchase.MODE_QTY
            qty = self._pick(data, "quantity_kg")
            rate = self._pick(data, "rate_inr")
            if qty > 0 and rate > 0:
                data["_computed_amount_inr"] = ROUND2(qty * rate)

        return data

    # ---------- DRF hooks ----------
    def validate(self, attrs):
        attrs = self._apply_derived_fields(attrs)
        return attrs

    def _persist_computed_amount(self, instance, validated_data):
        """
        amount_inr is computed server-side, not client-writable.
        Persist it whenever we have a fresh computed value.
        """
        computed = validated_data.pop("_computed_amount_inr", None)
        # purge write-only helper if present
        validated_data.pop("bill_amount", None)

        # Save instance via standard flow first (so file fields, FKs, etc. are handled)
        instance = super().update(instance, validated_data) if instance.pk else super().create(validated_data)

        if computed is not None:
            instance.amount_inr = ROUND2(computed)
            instance.save(update_fields=["amount_inr"])
        return instance

    def create(self, validated_data):
        # create with computed amount (if any)
        empty = self.Meta.model()  # dummy instance to use the shared helper
        return self._persist_computed_amount(empty, validated_data)

    def update(self, instance, validated_data):
        return self._persist_computed_amount(instance, validated_data)
