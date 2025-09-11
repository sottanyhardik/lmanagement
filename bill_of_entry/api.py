from django.db import transaction
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from easy_pdf.views import PDFTemplateView
from rest_framework import filters, viewsets
from rest_framework import permissions
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from license.models import Invoice
from license.serializers import InvoiceSerializer
from .filters import BillOfEntryFilter
from .models import BillOfEntryModel
from .serializers import BillOfEntrySerializer, BillOfEntryWriteSerializer, BOEOptionSerializer


class BillOfEntryViewSet(viewsets.ModelViewSet):
    queryset = BillOfEntryModel.objects.all().select_related('company', 'port').prefetch_related(
        'item_details').order_by('company__name').distinct()
    serializer_class = BillOfEntrySerializer
    # permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = BillOfEntryFilter
    search_fields = ['bill_of_entry_number', 'invoice_no', 'product_name',
                     'item_details__sr_number__license__license_number']
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
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['bills_of_entry']

    @transaction.atomic
    def perform_destroy(self, instance):
        """
        When deleting an invoice, if it is linked to a Bill of Entry, clear the
        Bill of Entry's cached `invoice_no` field. Safely handle the case where
        there is no linked BoE.
        """
        boe = getattr(instance, "bills_of_entry", None)
        if boe is not None:
            # Optional: only clear if it matches this invoice number
            inv_no = getattr(instance, "invoice_number", None)
            if hasattr(boe, "invoice_no"):
                if inv_no is None or boe.invoice_no == inv_no:
                    boe.invoice_no = None
                    boe.save(update_fields=["invoice_no"])
        # finally delete the invoice
        instance.delete()


class InvoicePDFView(PDFTemplateView):
    template_name = 'bill_of_entry/invoice_template.html'
    download_filename = 'invoice.pdf'

    def get_context_data(self, **kwargs):
        invoice = get_object_or_404(Invoice, pk=self.kwargs['pk'])
        entity = invoice.from_entity
        to = {
            'name': invoice.to_company_name,
            'address_line_1': invoice.to_company_address_line_1 or '',
            'address_line_2': invoice.to_company_address_line_2 or '',
            'pan': invoice.to_company_pan,
            'gst_number': invoice.to_company_gst_number,
        }

        items = invoice.items.all()
        bank = {
            'accountNo': entity.bank_account_number,
            'bankName': entity.bank_name,
            'ifsc': entity.ifsc_code,
            'accountType': entity.get_account_type_display(),
        }

        context = {
            'invoice': invoice,
            'entity': entity,
            'to_company': to,
            'items': [
                {
                    'licenseNo': str(item.license_no.replace('LIC ', '').split("• SR")[0]).zfill(10),
                    'hsnCode': item.hsn_code,
                    'qty': str(float(item.qty or 0)),
                    'cifUsd': str(float(item.cif_fc or 0)),
                    'exchangeRate': str(round(float(item.cif_inr or 0) / float(item.cif_fc or 1), 2)),
                    'cifInr': str(float(item.cif_inr or 0)),
                    'rate': str(float(item.rate or 0)),
                    'amount': str(float(item.amount or 0))
                } for item in items
            ],
            'amount_in_words': getattr(invoice, 'total_amount_in_words', ''),
            'bank': bank
        }
        return context

    def get_download_filename(self):
        return f"{self.invoice.invoice_number}.pdf"


class BOEOptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BillOfEntryModel.objects.select_related("company").all()
    serializer_class = BOEOptionSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["bill_of_entry_number", "company__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        # ✅ Only show BOEs that do NOT yet have an invoice number
        # (treat both NULL and empty-string as "no invoice")
        return qs.filter(Q(invoice_no__isnull=True) | Q(invoice_no=""))
