# trade/views/trade_views.py
import re
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

    from rest_framework import decorators

    @decorators.action(detail=False, methods=["GET"], url_path="next-invoice")
    def next_invoice(self, request):
        """
        Utility endpoint:
        GET /api/trades/next-invoice/?seller=<company_id>&date=YYYY-MM-DD
        Builds prefix from seller name and auto-resets serial when FY changes.
        """
        seller_id = request.query_params.get("seller")
        date_str = request.query_params.get("date")
        if not seller_id:
            return response.Response({"detail": "seller is required (Company ID)."}, status=400)

        # Resolve seller
        try:
            seller = CompanyModel.objects.get(pk=seller_id)
        except CompanyModel.DoesNotExist:
            return response.Response({"detail": "Seller company not found."}, status=404)

        # Resolve target date (for FY)
        if date_str:
            try:
                y, m, d = [int(x) for x in date_str.split("-")]
                dval = date_cls(y, m, d)
            except Exception:
                dval = date_cls.today()
        else:
            dval = date_cls.today()

        # ---- Build prefix from company name ----
        name = (seller.name or "").strip()
        if name:
            words = [w for w in re.split(r"\s+", name) if w]
            if len(words) > 1:
                # Take first letter of each word
                prefix = "".join(w[0] for w in words).upper()
            else:
                # Single word → first 3 letters
                prefix = words[0][:3].upper()
        else:
            prefix = "INV"

        # ---- Compute FY (Apr–Mar) as "YY-YY" ----
        # Example: for 2025-04-01 to 2026-03-31 → "25-26"
        start_year = dval.year if dval.month >= 4 else (dval.year - 1)
        fy = f"{str(start_year)[-2:]}-{str(start_year + 1)[-2:]}"

        # ---- Find next serial for this seller/prefix/FY (resets per FY) ----
        prefix_fy = f"{prefix}/{fy}/"
        qs = LicenseTrade.objects.filter(
            direction=LicenseTrade.DIR_SALE,  # numbering per seller's sales
            # from_company is the seller
            from_company=seller,
            invoice_number__startswith=prefix_fy,
        )

        # Extract max serial suffix
        max_serial = 0
        for inv in qs.values_list("invoice_number", flat=True):
            # Expect formats like "ABC/24-25/12" (be lenient on extra slashes)
            parts = str(inv or "").split("/")
            if len(parts) >= 3 and parts[0] == prefix and parts[1] == fy:
                try:
                    serial = int(parts[2])
                    if serial > max_serial:
                        max_serial = serial
                except (ValueError, TypeError):
                    pass

        next_serial = max_serial + 1
        inv = f"{prefix}/{fy}/{next_serial:04d}"

        return response.Response(
            {
                "invoice_number": inv,
                "prefix": prefix,
                "fy": fy,
            },
            status=status.HTTP_200_OK,
        )
