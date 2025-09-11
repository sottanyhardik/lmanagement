# trade/views/trade_views.py
from datetime import date as date_cls

from django.db.models import Sum, Value as V, DecimalField, F
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django_filters import rest_framework as filters
from rest_framework import viewsets, decorators, response, parsers, status
from rest_framework.filters import OrderingFilter, SearchFilter

from core.models import CompanyModel
from .filters import LicenseTradeFilter
from ..models import LicenseTrade
from ..serializers import LicenseTradeSerializer


class LicenseTradeViewSet(viewsets.ModelViewSet):
    queryset = (
        LicenseTrade.objects.select_related("from_company", "to_company", "boe")
        .prefetch_related("lines", "payments")
    )
    serializer_class = LicenseTradeSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    filter_backends = [filters.DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = LicenseTradeFilter
    search_fields = [
        "invoice_number",
        "remarks",
        "from_pan",
        "to_pan",
        "from_gst",
        "to_gst",
        "from_company__name",
        "to_company__name",
    ]
    ordering_fields = [
        "invoice_date",
        "created_on",
        "modified_on",
        "subtotal_amount",
        "roundoff",
        "total_amount",
        "paid_total",  # annotated
        "due_amount_calc",  # annotated alias
    ]
    ordering = ["-created_on"]

    def get_queryset(self):
        qs = super().get_queryset()
        paid_total = Coalesce(
            Sum("payments__amount"),
            V(0),
            output_field=DecimalField(max_digits=20, decimal_places=2),
        )
        qs = qs.annotate(paid_total=paid_total)
        qs = qs.annotate(due_amount_calc=F("total_amount") - F("paid_total"))
        return qs

    @decorators.action(detail=True, methods=["POST"], url_path="upload-invoice-copy")
    def upload_invoice_copy(self, request, pk=None):
        trade = self.get_object()
        if trade.direction != LicenseTrade.DIR_PURCHASE:
            return response.Response({"detail": "Only purchases can store invoice copy."}, status=400)
        f = request.FILES.get("file")
        if not f:
            return response.Response({"detail": "file is required"}, status=400)
        trade.purchase_invoice_copy = f
        trade.save(update_fields=["purchase_invoice_copy", "modified_on"])
        return response.Response(self.get_serializer(trade).data, status=200)

    @decorators.action(detail=True, methods=["GET"], url_path="invoice-pdf")
    def invoice_pdf(self, request, pk=None):
        trade = self.get_object()
        if trade.direction != LicenseTrade.DIR_SALE:
            return response.Response({"detail": "PDF is for sales only."}, status=status.HTTP_400_BAD_REQUEST)

        inv = (trade.invoice_number or str(trade.pk)).replace("\n", " ")
        pdf = (
                b"%PDF-1.4\n"
                b"1 0 obj<<>>endobj\n"
                b"2 0 obj<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
                b"/Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n"
                b"3 0 obj<< /Type /Pages /Kids [2 0 R] /Count 1 >>endobj\n"
                b"4 0 obj<< /Length 90 >>stream\n"
                b"BT /F1 24 Tf 72 770 Td (Invoice: " + inv.encode("utf-8") + b") Tj ET\nendstream\nendobj\n"
                                                                             b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
                                                                             b"xref\n0 6\n0000000000 65535 f \n"
                                                                             b"0000000010 00000 n \n0000000054 00000 n \n0000000171 00000 n \n"
                                                                             b"0000000234 00000 n \n0000000379 00000 n \n"
                                                                             b"trailer<< /Size 6 /Root 6 0 R >>\n"
                                                                             b"6 0 obj<< /Type /Catalog /Pages 3 0 R >>endobj\n"
                                                                             b"startxref\n480\n%%EOF\n"
        )
        resp = HttpResponse(pdf, content_type="application/pdf")
        fname = f"invoice-{trade.invoice_number or trade.pk}.pdf"
        resp["Content-Disposition"] = f'inline; filename="{fname}"'
        return resp

    @decorators.action(detail=False, methods=["GET"], url_path="next-invoice")
    def next_invoice(self, request):
        """
        Utility endpoint:
        GET /api/trades/next-invoice/?seller=<company_id>&date=YYYY-MM-DD
        Uses seller as FROM company (preferred). If not found, tries as Company pk anyway.
        """
        seller_id = request.query_params.get("seller")
        date_str = request.query_params.get("date")
        if not seller_id:
            return response.Response({"detail": "seller is required (Company ID)."}, status=400)

        try:
            seller = CompanyModel.objects.get(pk=seller_id)
        except CompanyModel.DoesNotExist:
            return response.Response({"detail": "Seller company not found."}, status=404)

        if date_str:
            try:
                y, m, d = [int(x) for x in date_str.split("-")]
                dval = date_cls(y, m, d)
            except Exception:
                dval = None
        else:
            dval = None

        inv = LicenseTrade.next_invoice_number(seller_company=seller, invoice_date=dval)
        return response.Response({
            "invoice_number": inv,
            "prefix": inv.split("/")[0] if inv else "",
            "fy": inv.split("/")[1] if inv and inv.count("/") >= 2 else "",
        })
