from django_filters.rest_framework import DjangoFilterBackend
from easy_pdf.views import PDFTemplateView
from rest_framework import filters, viewsets
from rest_framework import permissions
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import BillOfEntryFilter
from .models import BillOfEntryModel, Invoice
from .serializers import BillOfEntrySerializer, BillOfEntryWriteSerializer, InvoiceSerializer


class BillOfEntryViewSet(viewsets.ModelViewSet):
    queryset = BillOfEntryModel.objects.all().select_related('company', 'port').prefetch_related(
        'item_details').order_by('company__name').distinct()
    serializer_class = BillOfEntrySerializer
    # permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = BillOfEntryFilter
    search_fields = ['bill_of_entry_number', 'invoice_no', 'product_name']
    ordering_fields = ['bill_of_entry_date', 'bill_of_entry_number', 'exchange_rate']
    ordering = ['company__name']

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


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer


class InvoicePDFView(PDFTemplateView):
    template_name = 'bill_of_entry/invoice_template.html'
    download_filename = 'invoice.pdf'

    def get_context_data(self, **kwargs):
        invoice = get_object_or_404(Invoice, pk=self.kwargs['pk'])
        return {'invoice': invoice}
