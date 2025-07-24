# views.py
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters

from .models import AllotmentModel
from .serializers import AllotmentOptionSerializer


class AllotmentOptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AllotmentModel.objects.select_related('company', 'port')
    serializer_class = AllotmentOptionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['invoice', 'item_name', 'company__name']  # Text-based fields only

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(bill_of_entry__isnull=True)
        required_quantity = self.request.query_params.get('required_quantity')
        if required_quantity:
            qs = qs.filter(required_quantity=required_quantity)
        return qs
