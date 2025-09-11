# serializers.py

from django.db import transaction
from rest_framework import serializers

from allotment.models import AllotmentModel
from allotment.serializers import AllotmentOptionSerializer
from core.models import CompanyModel, PortModel
from core.serializers import PortOptionSerializer, CompanyOptionSerializer
from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer, InvoiceSerializer
from .models import BillOfEntryModel, RowDetails


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


class BOEOptionSerializer(serializers.ModelSerializer):
    company = CompanyOptionSerializer()

    class Meta:
        model = BillOfEntryModel
        fields = ["id", "bill_of_entry_number", "bill_of_entry_date", "company"]
