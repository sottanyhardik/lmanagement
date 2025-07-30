from rest_framework import serializers

from allotment.serializers import AllotmentOptionSerializer
from core.serializers import PortOptionSerializer, CompanyOptionSerializer
from license.serializers import LicenseImportItemsSelectSerializer
from .models import BillOfEntryModel, RowDetails


class RowDetailsSerializer(serializers.ModelSerializer):
    sr_number = LicenseImportItemsSelectSerializer()

    class Meta:
        model = RowDetails
        fields = [
            'id', 'bill_of_entry', 'row_type', 'sr_number',
            'transaction_type', 'cif_inr', 'cif_fc', 'qty'
        ]


class BillOfEntrySerializer(serializers.ModelSerializer):
    item_details = RowDetailsSerializer(many=True)
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()
    allotment = AllotmentOptionSerializer(many=True)

    class Meta:
        model = BillOfEntryModel
        fields = [
            'id', 'company', 'bill_of_entry_number', 'bill_of_entry_date', 'port',
            'exchange_rate', 'product_name', 'allotment', 'invoice_no',
            'item_details', 'get_total_inr', 'get_total_fc', 'get_total_quantity',
            'get_unit_price', 'get_exchange_rate', 'get_licenses'
        ]
        read_only_fields = [
            'get_total_inr', 'get_total_fc', 'get_total_quantity',
            'get_unit_price', 'get_exchange_rate', 'get_licenses'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('item_details', [])
        bill = BillOfEntryModel.objects.create(**validated_data)
        for item in items_data:
            RowDetails.objects.create(bill_of_entry=bill, **item)
        return bill

    def update(self, instance, validated_data):
        items_data = validated_data.pop('item_details', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.item_details.all().delete()
            for item in items_data:
                RowDetails.objects.create(bill_of_entry=instance, **item)

        return instance
