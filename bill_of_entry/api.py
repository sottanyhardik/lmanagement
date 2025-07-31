from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import BillOfEntryFilter
from .models import BillOfEntryModel
from .serializers import BillOfEntrySerializer, BillOfEntryWriteSerializer


class BillOfEntryViewSet(viewsets.ModelViewSet):
    queryset = BillOfEntryModel.objects.all().select_related('company', 'port').prefetch_related(
        'item_details').distinct()
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


class BillOfEntryBulkDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        ids = request.data.get('ids', [])
        if not isinstance(ids, list):
            return Response({'error': 'Invalid data format. Expected list of IDs.'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = BillOfEntryModel.objects.filter(id__in=ids).delete()
        return Response({'message': f'{deleted_count} entries deleted successfully.'}, status=status.HTTP_200_OK)
