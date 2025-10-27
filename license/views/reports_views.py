# reports/views.py
from io import BytesIO, StringIO
import csv
import json
from datetime import datetime
from decimal import Decimal
from typing import Iterator, List, Any, Dict

from django.http import (
    FileResponse,
    StreamingHttpResponse,
    HttpResponseBadRequest,
)
from django.views import View
from django.utils.decorators import method_decorator
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum, Value, FloatField, Q
from django.db.models.functions import Coalesce

# openpyxl for xlsx
try:
    from openpyxl import Workbook
    HAS_OPENPYXL = True
except Exception:
    HAS_OPENPYXL = False

# reportlab for PDF generation
try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate,
        Table,
        TableStyle,
        Paragraph,
        Spacer,
        PageBreak,
    )
    from reportlab.lib.styles import getSampleStyleSheet
    HAS_REPORTLAB = True
except Exception:
    HAS_REPORTLAB = False

CHUNK = 500  # chunk size for queryset iteration


def _sanitize_for_json(obj: Any) -> Any:
    """
    Recursively convert Decimal -> float and ensure nested structures are JSON-serializable.
    """
    if obj is None:
        return None
    if isinstance(obj, Decimal):
        try:
            return float(obj)
        except Exception:
            return str(obj)
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_sanitize_for_json(v) for v in obj]
    return obj


@method_decorator(staff_member_required, name="dispatch")
class LicenseReportView(View):
    """
    Generates a license report in CSV, XLSX or PDF.

    GET params:
      - format: csv (default), xlsx or pdf
      - company: partial company name filter (optional)
      - from: YYYY-MM-DD (license_date >=) optional
      - to: YYYY-MM-DD (license_date <=) optional
      - purchase_status: filter by purchase_status (e.g. MI)
    """

    FIELDNAMES = [
        "license_number",
        "license_date",
        "license_expiry_date",
        "exporter_name",
        "current_owner_name",
        "opening_balance",
        "opening_fob",
        "total_debit",
        "total_allotment",
        "live_balance_cif",
        "import_total_cif_fc",
        "cif_value_balance_biscuits",
    ]

    # Compact labels for PDF output (subset to keep width reasonable)
    PDF_COL_LABELS = [
        "License",
        "Lic Date",
        "Expiry",
        "Exporter",
        "Owner",
        "Opening Bal",
        "Opening FOB",
        "Debit",
        "Allotment",
        "Live Bal",
    ]

    def get(self, request, *args, **kwargs):
        fmt = request.GET.get("format", "pdf").lower()
        if fmt not in ("csv", "xlsx", "pdf"):
            return HttpResponseBadRequest("Invalid format. Use 'csv', 'xlsx' or 'pdf'.")

        if fmt == "xlsx" and not HAS_OPENPYXL:
            return HttpResponseBadRequest("openpyxl is required for xlsx output on the server.")
        if fmt == "pdf" and not HAS_REPORTLAB:
            return HttpResponseBadRequest("reportlab is required for pdf output on the server.")

        company = request.GET.get("company")
        date_from = request.GET.get("from")
        date_to = request.GET.get("to")
        purchase_status = request.GET.get("purchase_status")

        # lazy import to reduce startup cost
        from license.models import LicenseDetailsModel

        qs = LicenseDetailsModel.objects.all().select_related("exporter", "current_owner", "port")

        # company name partial match
        if company:
            qs = qs.filter(Q(exporter__name__icontains=company) | Q(current_owner__name__icontains=company))

        # purchase_status exact (case-insensitive)
        if purchase_status:
            qs = qs.filter(purchase_status__iexact=purchase_status)

        # optional date filters
        date_filters: Dict[str, datetime] = {}
        if date_from:
            try:
                date_filters["license_date__gte"] = datetime.strptime(date_from, "%Y-%m-%d").date()
            except ValueError:
                return HttpResponseBadRequest("Invalid 'from' date. Use YYYY-MM-DD.")
        if date_to:
            try:
                date_filters["license_date__lte"] = datetime.strptime(date_to, "%Y-%m-%d").date()
            except ValueError:
                return HttpResponseBadRequest("Invalid 'to' date. Use YYYY-MM-DD.")
        if date_filters:
            qs = qs.filter(**date_filters)

        # light annotation to reduce queries (ensure output_field matches numeric type)
        qs = qs.annotate(
            export_total_cif_fc=Coalesce(Sum("export_license__cif_fc"), Value(0.0), output_field=FloatField()),
        )

        def license_generator(queryset) -> Iterator[Dict[str, Any]]:
            """
            Yield sanitized rows in chunks.
            """
            start = 0
            while True:
                chunk = list(queryset[start : start + CHUNK])
                if not chunk:
                    break
                for lic in chunk:
                    # safe extraction with sanitization
                    try:
                        opening_balance = _sanitize_for_json(getattr(lic, "opening_balance", 0) or 0)
                    except Exception:
                        opening_balance = 0.0
                    try:
                        opening_fob = _sanitize_for_json(getattr(lic, "opening_fob", 0) or 0)
                    except Exception:
                        opening_fob = 0.0
                    try:
                        total_debit = _sanitize_for_json(getattr(lic, "get_total_debit", 0) or 0)
                    except Exception:
                        total_debit = 0.0
                    try:
                        total_allotment = _sanitize_for_json(getattr(lic, "get_total_allotment", 0) or 0)
                    except Exception:
                        total_allotment = 0.0
                    try:
                        live_balance = _sanitize_for_json(
                            lic.get_balance_cif if hasattr(lic, "get_balance_cif") else getattr(lic, "balance_cif", 0) or 0
                        )
                    except Exception:
                        live_balance = _sanitize_for_json(getattr(lic, "balance_cif", 0) or 0)

                    # import aggregate (only CIF FC as requested)
                    import_agg = lic.import_license.aggregate(
                        import_total_cif_fc=Coalesce(Sum("cif_fc"), Value(0.0), output_field=FloatField())
                    )

                    # biscuits domain helper (may return nested decimals)
                    biscuits_summary = None
                    if hasattr(lic, "cif_value_balance_biscuits"):
                        try:
                            biscuits_summary = lic.cif_value_balance_biscuits
                        except Exception:
                            biscuits_summary = None
                    sanitized_biscuits = _sanitize_for_json(biscuits_summary) if biscuits_summary is not None else None

                    row: Dict[str, Any] = {
                        "license_number": lic.license_number,
                        "license_date": lic.license_date.isoformat() if lic.license_date else "",
                        "license_expiry_date": lic.license_expiry_date.isoformat() if lic.license_expiry_date else "",
                        "exporter_name": getattr(getattr(lic, "exporter", None), "name", "") or "",
                        "current_owner_name": getattr(getattr(lic, "current_owner", None), "name", "") or "",
                        "opening_balance": opening_balance,
                        "opening_fob": opening_fob,
                        "total_debit": total_debit,
                        "total_allotment": total_allotment,
                        "live_balance_cif": live_balance,
                        "import_total_cif_fc": _sanitize_for_json(import_agg.get("import_total_cif_fc") or 0),
                        "cif_value_balance_biscuits": json.dumps(sanitized_biscuits) if sanitized_biscuits is not None else "",
                    }

                    yield row
                start += CHUNK

        # CSV - streamed (memory friendly)
        if fmt == "csv":
            def csv_stream():
                buffer = StringIO()
                writer = csv.DictWriter(buffer, fieldnames=self.FIELDNAMES)
                writer.writeheader()
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate(0)

                for r in license_generator(qs):
                    # ensure primitives for CSV
                    writer.writerow({k: ("" if v is None else v) for k, v in r.items()})
                    yield buffer.getvalue()
                    buffer.seek(0)
                    buffer.truncate(0)

            response = StreamingHttpResponse(csv_stream(), content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = 'attachment; filename="license_report.csv"'
            return response

        # XLSX - in-memory workbook (suitable for moderate-sized exports)
        if fmt == "xlsx":
            wb = Workbook()
            ws = wb.active
            ws.title = "Licenses"

            # header row
            ws.append(self.FIELDNAMES)

            # data rows
            for r in license_generator(qs):
                ws.append([r.get(col, "") for col in self.FIELDNAMES])

            # optional: adjust column widths
            try:
                from openpyxl.utils import get_column_letter
                for i, _col in enumerate(self.FIELDNAMES, start=1):
                    max_len = 0
                    for row_idx in range(1, ws.max_row + 1):
                        try:
                            cell_value = ws.cell(row=row_idx, column=i).value or ""
                            l = len(str(cell_value))
                            if l > max_len:
                                max_len = l
                        except Exception:
                            continue
                    ws.column_dimensions[get_column_letter(i)].width = min(max_len + 2, 60)
            except Exception:
                pass

            stream = BytesIO()
            wb.save(stream)
            stream.seek(0)
            return FileResponse(
                stream,
                as_attachment=True,
                filename="license_report.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        # PDF - table-based report (compact subset of columns)
        if fmt == "pdf":
            buffer = BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=landscape(A4),
                leftMargin=12 * mm,
                rightMargin=12 * mm,
                topMargin=12 * mm,
                bottomMargin=12 * mm,
            )
            styles = getSampleStyleSheet()
            elements: List[Any] = [
                Paragraph("License Report", styles["Title"]),
                Spacer(1, 6),
            ]

            header = self.PDF_COL_LABELS
            data: List[List[Any]] = [header]

            for r in license_generator(qs):
                row_vals = [
                    r.get("license_number", ""),
                    r.get("license_date", ""),
                    r.get("license_expiry_date", ""),
                    (r.get("exporter_name") or "")[:18],
                    (r.get("current_owner_name") or "")[:18],
                    f"{r.get('opening_balance', 0):,.2f}",
                    f"{r.get('opening_fob', 0):,.2f}",
                    f"{r.get('total_debit', 0):,.2f}",
                    f"{r.get('total_allotment', 0):,.2f}",
                    f"{r.get('live_balance_cif', 0):,.2f}",
                ]
                data.append(row_vals)

                # flush pages incrementally to avoid building a gigantic in-memory table
                if len(data) >= 400:
                    t = Table(data, repeatRows=1)
                    t.setStyle(
                        TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d3d3d3")),
                                ("GRID", (0, 0), (-1, -1), 0.25, colors.black),
                                ("FONTSIZE", (0, 0), (-1, -1), 8),
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ]
                        )
                    )
                    elements.append(t)
                    elements.append(PageBreak())
                    data = [header]

            if len(data) > 1:
                t = Table(data, repeatRows=1)
                t.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d3d3d3")),
                            ("GRID", (0, 0), (-1, -1), 0.25, colors.black),
                            ("FONTSIZE", (0, 0), (-1, -1), 8),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ]
                    )
                )
                elements.append(t)

            doc.build(elements)
            buffer.seek(0)

            # Serve inline so browser displays the PDF
            response = FileResponse(buffer, as_attachment=False, content_type="application/pdf")
            response["Content-Disposition"] = 'inline; filename="license_report.pdf"'
            return response

        return HttpResponseBadRequest("Unhandled format requested.")
