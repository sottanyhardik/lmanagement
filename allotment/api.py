# views.py
from django.db.models import Q
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
        request = self.request

        # Get current BOE id (if editing)
        boe_id = request.query_params.get('current_boe_id')
        exclude_assigned = request.query_params.get('exclude_assigned', 'true').lower() == 'true'

        if exclude_assigned:
            if boe_id:
                # Exclude allotments assigned to other BOEs
                qs = qs.exclude(~Q(bill_of_entry__id=boe_id) & Q(bill_of_entry__isnull=False))
            else:
                # New BOE case: show only unassigned
                qs = qs.filter(bill_of_entry__isnull=True)

        required_quantity = request.query_params.get('required_quantity')
        if required_quantity:
            qs = qs.filter(required_quantity=required_quantity)

        return qs
