# serializers.py
from datetime import date
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from allotment.models import AllotmentModel
from allotment.serializers import AllotmentOptionSerializer
from core.models import CompanyModel, PortModel, InvoiceEntity
from core.serializers import PortOptionSerializer, CompanyOptionSerializer, InvoiceEntitySerializer
from core.utils import number_to_words, get_entity_prefix
from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer
from .models import BillOfEntryModel, RowDetails, Invoice, InvoiceItem


# --------------------------- INVOICE SUB-ITEMS ---------------------------

class InvoiceItemSerializer(serializers.ModelSerializer):
    # Accept sr_number as a PK from FE; show PK back in reads
    sr_number = serializers.PrimaryKeyRelatedField(
        queryset=LicenseImportItemsModel.objects.all()
    )
    qty = serializers.DecimalField(max_digits=15, decimal_places=4, required=True)
    cif_fc = serializers.DecimalField(max_digits=15, decimal_places=4, required=False, allow_null=True)
    cif_inr = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    rate = serializers.DecimalField(max_digits=15, decimal_places=4, required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = InvoiceItem
        fields = ['sr_number', 'license_no', 'hsn_code', 'qty', 'cif_fc', 'cif_inr', 'rate', 'amount']


class ToCompanySerializer(serializers.Serializer):
    name = serializers.CharField()
    pan = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gst_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    address_line_1 = serializers.CharField()
    address_line_2 = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class InvoiceSerializer(serializers.ModelSerializer):
    from_entity_id = serializers.IntegerField(write_only=True)
    from_entity = InvoiceEntitySerializer(read_only=True)

    to_company = ToCompanySerializer(write_only=True)
    # Flattened fields (read-only) are filled from `to_company` on write
    to_company_name = serializers.CharField(read_only=True)
    to_company_pan = serializers.CharField(read_only=True)
    to_company_gst_number = serializers.CharField(read_only=True)
    to_company_address_line_1 = serializers.CharField(read_only=True)
    to_company_address_line_2 = serializers.CharField(read_only=True)

    billing_mode = serializers.ChoiceField(choices=['kg', 'cif_inr'])
    items = InvoiceItemSerializer(many=True)

    bills_of_entry_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    invoice_number = serializers.CharField(required=False, allow_blank=True)
    total_qty = serializers.DecimalField(max_digits=15, decimal_places=4, required=False, read_only=True)
    total_cif_fc = serializers.DecimalField(max_digits=15, decimal_places=4, required=False, read_only=True)
    total_cif_inr = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, read_only=True)
    total_amount = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, read_only=True)
    total_amount_in_words = serializers.CharField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'from_entity_id', 'from_entity',
            'to_company',
            'to_company_name', 'to_company_pan', 'to_company_gst_number',
            'to_company_address_line_1', 'to_company_address_line_2',
            'billing_mode',
            'total_qty', 'total_cif_fc', 'total_cif_inr', 'total_amount', 'total_amount_in_words',
            'items', 'invoice_number', 'invoice_date', 'bills_of_entry_id'
        ]
        read_only_fields = ['invoice_date']

    # ---------- Helpers ----------
    def _generate_invoice_number(self, entity_name: str) -> str:
        today = date.today()
        fy_start = today.year if today.month >= 4 else today.year - 1
        fy_end = fy_start + 1
        fy = f"{fy_start}-{str(fy_end)[-2:]}"
        prefix = get_entity_prefix(entity_name)

        last = Invoice.objects.filter(
            invoice_number__startswith=f"{prefix}/{fy}"
        ).order_by('-invoice_number').first()

        if last and last.invoice_number:
            try:
                last_serial = int(last.invoice_number.split('/')[-1])
            except Exception:
                last_serial = 0
        else:
            last_serial = 0

        return f"{prefix}/{fy}/{last_serial + 1:03d}"

    def _flatten_to_company(self, validated_data, to_company_data):
        validated_data.update({
            'to_company_name': to_company_data.get('name', ''),
            'to_company_pan': to_company_data.get('pan') or '',
            'to_company_gst_number': to_company_data.get('gst_number') or '',
            'to_company_address_line_1': to_company_data.get('address_line_1', ''),
            'to_company_address_line_2': to_company_data.get('address_line_2') or '',
        })

    def _recompute_totals(self, instance: Invoice):
        # Aggregate from items
        qs = instance.items.all()
        total_qty = sum((x.qty or Decimal('0')) for x in qs)
        total_fc = sum((x.cif_fc or Decimal('0')) for x in qs)
        total_inr = sum((x.cif_inr or Decimal('0')) for x in qs)
        total_amt = sum((x.amount or Decimal('0')) for x in qs)

        instance.total_qty = total_qty
        instance.total_cif_fc = total_fc
        instance.total_cif_inr = total_inr
        instance.total_amount = total_amt
        instance.total_amount_in_words = number_to_words(round(instance.total_amount or 0, 0))
        instance.save(update_fields=[
            'total_qty', 'total_cif_fc', 'total_cif_inr', 'total_amount', 'total_amount_in_words'
        ])

    # ---------- Create / Update ----------
    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        from_entity_id = validated_data.pop('from_entity_id')
        to_company_data = validated_data.pop('to_company')
        boe_id = validated_data.pop('bills_of_entry_id', None)
        invoice_number = validated_data.pop('invoice_number', None)

        if boe_id:
            validated_data['bills_of_entry'] = BillOfEntryModel.objects.get(pk=boe_id)

        from_entity = InvoiceEntity.objects.get(pk=from_entity_id)
        if not invoice_number:
            invoice_number = self._generate_invoice_number(from_entity.name)

        validated_data['from_entity'] = from_entity
        validated_data['invoice_number'] = invoice_number
        self._flatten_to_company(validated_data, to_company_data)

        invoice = Invoice.objects.create(**validated_data)

        # Items
        for item in items_data:
            # Allow sr_number as PK or instance
            sr = item.get('sr_number')
            if hasattr(sr, 'pk'):
                item['sr_number'] = sr
            # transaction_type default
            item.setdefault('transaction_type', 'D')
            InvoiceItem.objects.create(invoice=invoice, **item)

        # Totals + BOE backfill
        self._recompute_totals(invoice)
        if boe_id:
            BillOfEntryModel.objects.filter(id=boe_id).update(invoice_no=invoice.invoice_number)

        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        from_entity_id = validated_data.pop('from_entity_id', None)
        to_company_data = validated_data.pop('to_company', None)

        if to_company_data:
            self._flatten_to_company(validated_data, to_company_data)

        if from_entity_id:
            instance.from_entity = InvoiceEntity.objects.get(pk=from_entity_id)

        # Patch simple fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Upsert items by sr_number
        if items_data is not None:
            existing_by_sr = {it.sr_number_id: it for it in instance.items.all()}
            seen = set()
            for item in items_data:
                sr = item.get('sr_number')
                sr_id = sr.id if hasattr(sr, 'id') else sr
                seen.add(sr_id)
                obj = existing_by_sr.get(sr_id)
                item.setdefault('transaction_type', 'D')
                if obj:
                    # Update existing
                    for k, v in item.items():
                        setattr(obj, k, v)
                    obj.save()
                else:
                    InvoiceItem.objects.create(invoice=instance, **item)
            # Delete removed
            for sr_id, obj in existing_by_sr.items():
                if sr_id not in seen:
                    obj.delete()

        # Totals
        self._recompute_totals(instance)
        return instance


# --------------------------- BOE READ/WRITE ---------------------------

class RowDetailsSerializer(serializers.ModelSerializer):
    # READ serializer (as your FE expects)
    sr_number = LicenseImportItemsSelectSerializer()

    class Meta:
        model = RowDetails
        fields = ['id', 'bill_of_entry', 'row_type', 'sr_number', 'transaction_type', 'cif_inr', 'cif_fc', 'qty']


class BOEItemSerializer(serializers.ModelSerializer):
    # WRITE serializer: accept PK for sr_number
    sr_number = serializers.PrimaryKeyRelatedField(
        queryset=LicenseImportItemsModel.objects.all(),
        required=True
    )
    qty = serializers.DecimalField(max_digits=15, decimal_places=4)
    cif_fc = serializers.DecimalField(max_digits=15, decimal_places=4)
    cif_inr = serializers.DecimalField(max_digits=15, decimal_places=2)
    transaction_type = serializers.ChoiceField(choices=['D', 'C'], required=False, default='D')

    class Meta:
        model = RowDetails
        fields = ['sr_number', 'qty', 'cif_fc', 'cif_inr', 'transaction_type']


class BillOfEntrySerializer(serializers.ModelSerializer):
    item_details = RowDetailsSerializer(many=True)
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()
    allotment = AllotmentOptionSerializer(many=True)
    invoices = InvoiceSerializer(many=True, read_only=True)

    class Meta:
        model = BillOfEntryModel
        fields = [
            'id', 'company', 'bill_of_entry_number', 'bill_of_entry_date', 'port',
            'exchange_rate', 'product_name', 'allotment', 'invoice_no',
            'item_details',
            'get_total_inr', 'get_total_fc', 'get_total_quantity',
            'get_unit_price', 'get_exchange_rate', 'get_licenses',
            'invoices'
        ]
        read_only_fields = [
            'get_total_inr', 'get_total_fc', 'get_total_quantity',
            'get_unit_price', 'get_exchange_rate', 'get_licenses'
        ]


class BillOfEntryWriteSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=CompanyModel.objects.all())
    port = serializers.PrimaryKeyRelatedField(queryset=PortModel.objects.all())
    allotment = serializers.PrimaryKeyRelatedField(queryset=AllotmentModel.objects.all(), many=True)
    item_details = BOEItemSerializer(many=True)

    class Meta:
        model = BillOfEntryModel
        # Explicit list is safer than '__all__' (avoids accidental write to computed/readonly fields)
        fields = [
            'id', 'company', 'bill_of_entry_number', 'bill_of_entry_date', 'port',
            'exchange_rate', 'product_name', 'allotment', 'invoice_no', 'item_details'
        ]

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('item_details', [])
        allotments = validated_data.pop('allotment', [])
        bill = BillOfEntryModel.objects.create(**validated_data)
        if allotments:
            bill.allotment.set(allotments)
        # bulk create rows
        RowDetails.objects.bulk_create([
            RowDetails(bill_of_entry=bill, **item) for item in items_data
        ])
        return bill

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop('item_details', None)
        allotments = validated_data.pop('allotment', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if allotments is not None:
            instance.allotment.set(allotments)

        if items_data is not None:
            instance.item_details.all().delete()
            RowDetails.objects.bulk_create([
                RowDetails(bill_of_entry=instance, **item) for item in items_data
            ])

        return instance
