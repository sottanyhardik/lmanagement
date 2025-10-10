# trade/serializers.py
from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

from bill_of_entry.models import BillOfEntryModel
from bill_of_entry.serializers import BOEOptionSerializer
from core.models import CompanyModel
from core.serializers import CompanySerializer
from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer
from .models import LicenseTrade, LicenseTradeLine, LicenseTradePayment


# ----------------------------
# Line & Payment serializers
# ----------------------------
class LicenseTradeLineSerializer(serializers.ModelSerializer):
    sr_number = serializers.PrimaryKeyRelatedField(
        queryset=LicenseImportItemsModel.objects.all()
    )

    class Meta:
        model = LicenseTradeLine
        fields = [
            "id",
            "sr_number",
            "description",
            "mode",
            "qty_kg",
            "rate_inr_per_kg",
            "cif_fc",
            "exc_rate",
            "cif_inr",
            "fob_inr",
            "pct",
            "amount_inr",
        ]
        read_only_fields = ["amount_inr"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Swap sr_number pk with nested representation for reads
        data["sr_number"] = LicenseImportItemsSelectSerializer(instance.sr_number).data
        return data


class LicenseTradePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicenseTradePayment
        fields = ["id", "date", "amount", "note"]


# ----------------------------
# Trade (header) serializer
# ----------------------------
class LicenseTradeSerializer(serializers.ModelSerializer):
    # Read-only nested companies for display
    from_company = CompanySerializer(read_only=True)
    to_company = CompanySerializer(read_only=True)

    # Read-only BOE (display only)
    boe = BOEOptionSerializer(read_only=True)

    # Write-only IDs mapped to model fields using `source=*`
    from_company_id = serializers.PrimaryKeyRelatedField(
        queryset=CompanyModel.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        source="from_company",
    )
    to_company_id = serializers.PrimaryKeyRelatedField(
        queryset=CompanyModel.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        source="to_company",
    )
    # 👉 NEW: write-only BOE id (create/update with this)
    boe_id = serializers.PrimaryKeyRelatedField(
        queryset=BillOfEntryModel.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        source="boe",
    )

    lines = LicenseTradeLineSerializer(many=True)
    payments = LicenseTradePaymentSerializer(many=True, read_only=True)

    # derived/read-only helpers
    paid_total = serializers.SerializerMethodField()
    due_amount = serializers.SerializerMethodField()
    sale_pdf_url = serializers.SerializerMethodField()
    purchase_invoice_copy_url = serializers.SerializerMethodField()

    class Meta:
        model = LicenseTrade
        fields = [
            "id",
            "direction",

            # BOE
            "boe",  # read-only nested
            "boe_id",  # write-only id

            # companies (read-only nested + write-only ids)
            "from_company", "from_company_id",
            "to_company", "to_company_id",

            # snapshots
            "from_pan",
            "from_gst",
            "from_addr_line_1",
            "from_addr_line_2",
            "to_pan",
            "to_gst",
            "to_addr_line_1",
            "to_addr_line_2",

            # header
            "invoice_number",
            "invoice_date",
            "remarks",

            # totals
            "subtotal_amount",
            "roundoff",
            "total_amount",

            # files/links
            "purchase_invoice_copy",
            "purchase_invoice_copy_url",

            # nested
            "lines",
            "payments",

            # derived
            "paid_total",
            "due_amount",
            "sale_pdf_url",

            # audit
            "created_on",
            "modified_on",
        ]
        read_only_fields = [
            "subtotal_amount",
            "roundoff",
            "total_amount",
            "purchase_invoice_copy_url",
            "paid_total",
            "due_amount",
            "sale_pdf_url",
            "created_on",
            "modified_on",
            "boe",  # keep boe read-only nested
        ]

    # --------- derived getters ---------
    def get_paid_total(self, obj):
        agg = obj.payments.aggregate(s=Sum("amount"))
        return agg["s"] or 0

    def get_due_amount(self, obj):
        paid = self.get_paid_total(obj) or 0
        return (obj.total_amount or 0) - paid

    def get_sale_pdf_url(self, obj):
        if obj.direction != LicenseTrade.DIR_SALE:
            return None
        request = self.context.get("request")
        if not request:
            return None
        return request.build_absolute_uri(f"/api/trades/{obj.pk}/invoice-pdf/")

    def get_purchase_invoice_copy_url(self, obj):
        f = getattr(obj, "purchase_invoice_copy", None)
        if not f:
            return None
        try:
            url = f.url
        except Exception:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    # --------- validation ---------
    def validate(self, attrs):
        """
        Business rules:
        - From Company and To Company cannot be the same
        - PURCHASE: from_company required; invoice_number OPTIONAL
        - SALE:     to_company required; invoice_number OPTIONAL (will auto-generate if blank)
        - Uniqueness checks apply ONLY when invoice_number is non-blank (DB constraint also enforces this)
        """
        instance = getattr(self, "instance", None)

        # Resolve values considering updates (instance) and partials
        direction = attrs.get("direction", getattr(instance, "direction", None))
        invoice_number = attrs.get("invoice_number", getattr(instance, "invoice_number", "")) or ""

        from_company = attrs.get("from_company", getattr(instance, "from_company", None))
        to_company = attrs.get("to_company", getattr(instance, "to_company", None))

        # A) From/To cannot be same (give nice API error)
        if from_company and to_company and from_company_id(from_company) == from_company_id(to_company):
            raise serializers.ValidationError({
                "from_company_id": "From Company and To Company cannot be the same.",
                "to_company_id": "From Company and To Company cannot be the same.",
            })

        # B) Directional requirements + uniqueness
        qs = LicenseTrade.objects.all()
        if instance:
            qs = qs.exclude(pk=instance.pk)

        if direction == LicenseTrade.DIR_PURCHASE:
            if not from_company:
                raise serializers.ValidationError({"from_company_id": "From Company is required for purchases."})
            # Invoice number optional for PURCHASE; check uniqueness only if non-blank
            if invoice_number.strip():
                if qs.filter(
                        direction=LicenseTrade.DIR_PURCHASE,
                        from_company=from_company,
                        invoice_number=invoice_number,
                ).exists():
                    raise serializers.ValidationError({
                        "invoice_number": "This supplier + invoice number already exists (purchase)."
                    })

        elif direction == LicenseTrade.DIR_SALE:
            if not to_company:
                raise serializers.ValidationError({"to_company_id": "To Company is required for sales."})
            # Invoice number optional for SALE; will be generated if blank
            if invoice_number.strip():
                if qs.filter(
                        direction=LicenseTrade.DIR_SALE,
                        to_company=to_company,
                        invoice_number=invoice_number,
                ).exists():
                    raise serializers.ValidationError({
                        "invoice_number": "This buyer + invoice number already exists (sale)."
                    })

        return attrs

    # --------- create / update ---------
    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        trade = LicenseTrade.objects.create(**validated_data)

        # For SALE: auto-generate if blank
        if trade.direction == LicenseTrade.DIR_SALE and not (trade.invoice_number or "").strip():
            seller = trade.from_company or trade.to_company  # prefer from_company; fallback to to_company
            if seller:
                trade.invoice_number = LicenseTrade.next_invoice_number(
                    seller_company=seller,
                    invoice_date=trade.invoice_date,
                )
                trade.save(update_fields=["invoice_number", "modified_on"])

        # Fill snapshot fields from companies (if missing)
        trade.snapshot_parties()

        # Create lines — bulk_create doesn't call save(); precompute amount
        if lines_data:
            objs = []
            for ld in lines_data:
                line = LicenseTradeLine(trade=trade, **ld)
                line.amount_inr = line.compute_amount()
                objs.append(line)
            LicenseTradeLine.objects.bulk_create(objs)

        # Roll-up totals
        trade.recompute_totals()

        # ✅ If SALE + BOE present, sync invoice_no to BOE
        if trade.direction == LicenseTrade.DIR_SALE and trade.boe_id and trade.invoice_number:
            try:
                trade.boe.invoice_no = trade.invoice_number
                trade.boe.save(update_fields=["invoice_no"])
            except Exception:
                pass
        return trade

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)

        # Update header fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # For SALE: auto-generate if still blank
        if instance.direction == LicenseTrade.DIR_SALE and not (instance.invoice_number or "").strip():
            seller = instance.from_company or instance.to_company
            if seller:
                instance.invoice_number = LicenseTrade.next_invoice_number(
                    seller_company=seller,
                    invoice_date=instance.invoice_date,
                )
                instance.save(update_fields=["invoice_number", "modified_on"])

        # Refresh snapshots
        instance.snapshot_parties()

        # Replace lines if provided
        if lines_data is not None:
            instance.lines.all().delete()
            if lines_data:
                objs = []
                for ld in lines_data:
                    line = LicenseTradeLine(trade=instance, **ld)
                    line.amount_inr = line.compute_amount()
                    objs.append(line)
                LicenseTradeLine.objects.bulk_create(objs)

        # Recompute totals
        instance.recompute_totals()

        # Keep BOE invoice_no in sync for SALE
        if instance.direction == LicenseTrade.DIR_SALE and instance.boe_id and instance.invoice_number:
            try:
                instance.boe.invoice_no = instance.invoice_number
                instance.boe.save(update_fields=["invoice_no"])
            except Exception:
                pass
        return instance


def from_company_id(company):
    """Return comparable id from Company instance (or None)."""
    if company is None:
        return None
    try:
        return company.pk
    except Exception:
        return getattr(company, "id", None)
