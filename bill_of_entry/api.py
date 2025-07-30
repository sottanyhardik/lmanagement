from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from .filters import BillOfEntryFilter
from .models import BillOfEntryModel
from .serializers import BillOfEntrySerializer, BillOfEntryWriteSerializer


class BillOfEntryViewSet(viewsets.ModelViewSet):
    queryset = BillOfEntryModel.objects.all().select_related('company', 'port').prefetch_related('item_details')
    serializer_class = BillOfEntrySerializer
    # permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = BillOfEntryFilter
    search_fields = ['bill_of_entry_number', 'invoice_no', 'product_name']
    ordering_fields = ['bill_of_entry_date', 'bill_of_entry_number', 'exchange_rate']
    ordering = ['-bill_of_entry_date']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BillOfEntryWriteSerializer
        return BillOfEntrySerializer
