from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from .models import BillOfEntryModel
from .serializers import BillOfEntrySerializer


class BillOfEntryViewSet(viewsets.ModelViewSet):
    queryset = BillOfEntryModel.objects.all().select_related('company', 'port').prefetch_related('item_details')
    serializer_class = BillOfEntrySerializer
    # permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['company', 'port', 'bill_of_entry_date', 'is_fetch']
    search_fields = ['bill_of_entry_number', 'invoice_no', 'product_name']
    ordering_fields = ['bill_of_entry_date', 'bill_of_entry_number', 'exchange_rate']
    ordering = ['-bill_of_entry_date']
