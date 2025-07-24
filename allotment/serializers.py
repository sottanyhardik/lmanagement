from rest_framework import serializers

from allotment.models import AllotmentModel
from core.serializers import PortOptionSerializer, CompanyOptionSerializer


class AllotmentOptionSerializer(serializers.ModelSerializer):
    port = PortOptionSerializer()
    company = CompanyOptionSerializer()

    class Meta:
        model = AllotmentModel
        fields = ['id', 'company', 'port', 'required_quantity', 'invoice', 'item_name']
