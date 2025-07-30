from rest_framework import serializers

from allotment.models import AllotmentModel, AllotmentItems
from core.serializers import PortOptionSerializer, CompanyOptionSerializer
from license.serializers import LicenseImportItemsSelectSerializer


class AllotmentItemSerializer(serializers.ModelSerializer):
    item = LicenseImportItemsSelectSerializer()

    class Meta:
        model = AllotmentItems
        fields = ['id', 'item', 'qty', 'cif_fc', 'cif_inr']


class AllotmentOptionSerializer(serializers.ModelSerializer):
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()
    item_details = AllotmentItemSerializer(source='allotment_details', many=True)

    class Meta:
        model = AllotmentModel
        fields = ['id', 'company', 'port', 'required_quantity', 'invoice', 'item_name', 'item_details']
