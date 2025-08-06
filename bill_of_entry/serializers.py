from datetime import date

from rest_framework import serializers

from allotment.models import AllotmentModel
from allotment.serializers import AllotmentOptionSerializer
from core.models import CompanyModel, PortModel, InvoiceEntity
from core.serializers import PortOptionSerializer, CompanyOptionSerializer, InvoiceEntitySerializer
from core.utils import number_to_words, get_entity_prefix
from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer
from .models import BillOfEntryModel, RowDetails
from .models import Invoice, InvoiceItem


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['sr_number', 'license_no', 'hsn_code', 'qty', 'cif_fc', 'cif_inr', 'rate', 'amount']


class ToCompanySerializer(serializers.Serializer):
    name = serializers.CharField()
    pan = serializers.CharField(required=False)
    gst_number = serializers.CharField(required=False)
    address_line_1 = serializers.CharField()
    address_line_2 = serializers.CharField(required=False, allow_blank=True)


class InvoiceSerializer(serializers.ModelSerializer):
    from_entity_id = serializers.IntegerField(write_only=True)
    from_entity = InvoiceEntitySerializer(read_only=True)
    to_company = ToCompanySerializer(write_only=True)  # Nested serializer
    billing_mode = serializers.ChoiceField(choices=['kg', 'cif_inr'])
    items = InvoiceItemSerializer(many=True)
    bills_of_entry_id = serializers.IntegerField(write_only=True, required=False)
    invoice_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'from_entity_id', 'from_entity', 'to_company',
            'to_company_name', 'to_company_pan', 'to_company_gst_number',
            'to_company_address_line_1', 'to_company_address_line_2',
            'billing_mode', 'total_qty', 'total_cif_fc', 'total_cif_inr', 'total_amount',
            'items', 'invoice_number', 'invoice_date', 'bills_of_entry_id', 'total_amount_in_words'
        ]
        read_only_fields = [
            'invoice_date',
            'to_company_name', 'to_company_pan', 'to_company_gst_number',
            'to_company_address_line_1', 'to_company_address_line_2',
        ]

    def generate_invoice_number(self, entity_name):
        today = date.today()
        fy_start = today.year if today.month >= 4 else today.year - 1
        fy_end = fy_start + 1
        fy = f"{fy_start}-{str(fy_end)[-2:]}"
        prefix = get_entity_prefix(entity_name)

        max_serial = Invoice.objects.filter(
            invoice_number__startswith=f"{prefix}/{fy}"
        ).order_by('-invoice_number').first()

        if max_serial and max_serial.invoice_number:
            try:
                last_serial = int(max_serial.invoice_number.split('/')[-1])
            except (IndexError, ValueError):
                last_serial = 0
        else:
            last_serial = 0

        new_serial = last_serial + 1
        return f"{prefix}/{fy}/{new_serial:03d}"

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        from_entity_id = validated_data.pop('from_entity_id')
        to_company_data = validated_data.pop('to_company')
        boe_id = validated_data.pop('bills_of_entry_id', None)
        invoice_number = validated_data.pop('invoice_number', None)

        if boe_id:
            validated_data['bills_of_entry'] = BillOfEntryModel.objects.get(pk=boe_id)

        from_entity = InvoiceEntity.objects.get(pk=from_entity_id)
        if not invoice_number:
            invoice_number = self.generate_invoice_number(from_entity.name)

        validated_data['from_entity'] = from_entity
        validated_data['invoice_number'] = invoice_number

        # Flatten to_company fields into Invoice model
        validated_data.update({
            'to_company_name': to_company_data['name'],
            'to_company_pan': to_company_data['pan'],
            'to_company_gst_number': to_company_data['gst_number'],
            'to_company_address_line_1': to_company_data['address_line_1'],
            'to_company_address_line_2': to_company_data.get('address_line_2', ''),
        })

        invoice = Invoice.objects.create(**validated_data)
        invoice.total_amount_in_words = number_to_words(round(invoice.total_amount, 0))
        invoice.save()
        BillOfEntryModel.objects.filter(id=boe_id).update(invoice_no=invoice.invoice_number)
        for item in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item)

        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items')
        from_entity_id = validated_data.pop('from_entity_id', None)
        to_company_data = validated_data.pop('to_company', None)

        if to_company_data:
            validated_data.update({
                'to_company_name': to_company_data['name'],
                'to_company_pan': to_company_data['pan'],
                'to_company_gst_number': to_company_data['gst_number'],
                'to_company_address_line_1': to_company_data['address_line_1'],
                'to_company_address_line_2': to_company_data.get('address_line_2', ''),
            })

        if from_entity_id:
            instance.from_entity = InvoiceEntity.objects.get(pk=from_entity_id)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.total_amount_in_words = number_to_words(instance.total_amount)
        instance.save()
        existing_items = {item.sr_number_id: item for item in instance.items.all()}
        new_sr_ids = set()

        for item_data in items_data:
            sr_id = item_data['sr_number'].id if hasattr(item_data['sr_number'], 'id') else item_data['sr_number']
            new_sr_ids.add(sr_id)

            if sr_id in existing_items:
                item = existing_items[sr_id]
                for key, val in item_data.items():
                    setattr(item, key, val)
                item.save()
            else:
                InvoiceItem.objects.create(invoice=instance, **item_data)

        # Delete items that are no longer present
        for sr_id, item in existing_items.items():
            if sr_id not in new_sr_ids:
                item.delete()

        return instance


class RowDetailsSerializer(serializers.ModelSerializer):
    sr_number = LicenseImportItemsSelectSerializer()

    class Meta:
        model = RowDetails
        fields = [
            'id', 'bill_of_entry', 'row_type', 'sr_number',
            'transaction_type', 'cif_inr', 'cif_fc', 'qty'
        ]


class BOEItemSerializer(serializers.ModelSerializer):
    sr_number = serializers.PrimaryKeyRelatedField(
        queryset=LicenseImportItemsModel.objects.all(),
        required=True
    )

    class Meta:
        model = RowDetails  # or BOEItemModel
        fields = ['sr_number', 'qty', 'cif_fc', 'cif_inr', 'transaction_type']


class BillOfEntrySerializer(serializers.ModelSerializer):
    item_details = RowDetailsSerializer(many=True)
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()
    allotment = AllotmentOptionSerializer(many=True)
    invoices = InvoiceSerializer(many=True)

    class Meta:
        model = BillOfEntryModel
        fields = [
            'id', 'company', 'bill_of_entry_number', 'bill_of_entry_date', 'port',
            'exchange_rate', 'product_name', 'allotment', 'invoice_no',
            'item_details', 'get_total_inr', 'get_total_fc', 'get_total_quantity',
            'get_unit_price', 'get_exchange_rate', 'get_licenses', 'invoices'
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
        fields = '__all__'

    def create(self, validated_data):
        items_data = validated_data.pop('item_details', [])
        allotments = validated_data.pop('allotment', [])

        # Create the Bill first
        bill = BillOfEntryModel.objects.create(**validated_data)

        # Set the M2M field properly
        bill.allotment.set(allotments)

        # Create related item rows
        for item in items_data:
            RowDetails.objects.create(bill_of_entry=bill, **item)

        return bill

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
            for item in items_data:
                RowDetails.objects.create(bill_of_entry=instance, **item)

        return instance
