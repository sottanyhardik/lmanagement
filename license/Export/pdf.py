# views.py
from collections import defaultdict, OrderedDict
from datetime import datetime, date, datetime as dt
from io import BytesIO

from django.db.models import Prefetch
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, KeepTogether
)
from rest_framework.views import APIView

from license.models import (
    LicenseDetailsModel,
    LicenseImportItemsModel,
    LicenseExportItemModel,  # adjust if your model name differs
)


class LicenseExportPDFView(APIView):
    """
    PDF (inline): Group licenses by SION norm and render ONE merged table per norm.

    Columns = fixed license fields + (per unique M2M item name) these subcolumns:
      HSN | Description | Quantity | Debited Qty | Debited Value | Allotted Qty | Allotted Value | Available Qty
    Rows   = licenses belonging to that norm (license may appear in multiple norms if applicable).
    """

    # permission_classes = [IsAuthenticated]

    # Left-side fixed license columns
    BASE_COLS = [
        ("License Number", lambda l: l.license_number),
        ("License Date", lambda l: l.license_date),
        ("Expiry Date", lambda l: l.license_expiry_date),
        ("Exporter", lambda l: getattr(l.exporter, "name", "")),
        ("Port", lambda l: getattr(l.port, "name", "")),
        ("Notification Number", lambda l: l.notification_number),
        ("Balance CIF", lambda l: l.balance_cif),
        ("Purchase Status", lambda l: l.purchase_status),
    ]
    BASE_WIDTHS_MM = [28, 22, 22, 32, 28, 30, 22, 26]

    # Per‑item dynamic subcolumns (order matters)
    ITEM_SUBCOLS = [
        ("HSN", "hsn"),
        ("Description", "desc"),
        ("Quantity", "qty"),  # import item 'quantity'
        ("Debited Qty", "deb_qty"),  # debited_quantity
        ("Debited Value", "deb_val"),  # debited_value
        ("Allotted Qty", "all_qty"),  # allotted_quantity
        ("Allotted Value", "all_val"),  # allotted_value
        ("Available Qty", "avail_qty"),  # available_quantity
    ]
    ITEM_SUB_WIDTHS_MM = [20, 40, 18, 18, 20, 18, 20, 18]

    def get(self, request, *args, **kwargs):
        # -------- Queryset with prefetches --------
        qs = (
            LicenseDetailsModel.objects
            .select_related("exporter", "port")
            .prefetch_related(
                Prefetch(
                    "import_license",
                    queryset=LicenseImportItemsModel.objects
                    .prefetch_related("items", "hs_code")
                    .order_by("serial_number")
                ),
                Prefetch(
                    "export_license",
                    queryset=LicenseExportItemModel.objects
                    .select_related("norm_class")
                    .order_by("id")
                ),
            )
            .order_by("-modified_on", "-id")
        )
        licenses = list(qs)

        # -------- Group licenses by SION norm (include "No Norm") --------
        groups: dict[str, list] = defaultdict(list)
        for lic in licenses:
            for code in _norm_codes_for_license(lic):
                groups[code].append(lic)

        if not groups:
            return HttpResponse(b"No data", content_type="text/plain")

        # Sort groups; "No Norm" last
        norm_codes_sorted = sorted(groups.keys(), key=lambda x: (x == "No Norm", x.lower()))

        # -------- Determine widest table (sets page width) --------
        max_width_mm = sum(self.BASE_WIDTHS_MM)
        items_per_group: dict[str, list[str]] = {}
        for code in norm_codes_sorted:
            item_names = _item_names_for_licenses(groups[code])
            items_per_group[code] = item_names
            width_mm = sum(self.BASE_WIDTHS_MM) + len(item_names) * sum(self.ITEM_SUB_WIDTHS_MM)
            max_width_mm = max(max_width_mm, width_mm)

        # -------- Styles --------
        styles = getSampleStyleSheet()
        h3 = styles["Heading3"]
        normal = styles["Normal"]

        header_style = ParagraphStyle(
            "Header", parent=normal, fontSize=9, leading=11, textColor=colors.white, alignment=1
        )
        cell_style = ParagraphStyle(
            "Cell", parent=normal, fontSize=8.5, leading=10.5
        )

        # -------- Document setup --------
        left_margin = 12 * mm
        right_margin = 12 * mm
        top_margin = 12 * mm
        bottom_margin = 15 * mm
        page_h = landscape(A4)[1]
        page_w = (max_width_mm * mm) + left_margin + right_margin

        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=(page_w, page_h),
            leftMargin=left_margin,
            rightMargin=right_margin,
            topMargin=top_margin,
            bottomMargin=bottom_margin,
            title="Licenses — Merged by SION Norm",
        )

        elements = []
        first_section = True

        # -------- Build per‑norm tables --------
        for code in norm_codes_sorted:
            group_licenses = groups[code]
            if not group_licenses:
                continue

            if not first_section:
                elements.append(Spacer(1, 8))
            first_section = False

            elements.append(Paragraph(f"SION Norm: <b>{code}</b>", h3))
            elements.append(Spacer(1, 4))

            # Headers: base + dynamic per‑item subheaders for THIS norm group
            item_names = items_per_group[code]
            headers = [t for t, _ in self.BASE_COLS]
            col_widths_mm = list(self.BASE_WIDTHS_MM)
            for item in item_names:
                for sub, _ in self.ITEM_SUBCOLS:
                    headers.append(f"{item} — {sub}")
                col_widths_mm.extend(self.ITEM_SUB_WIDTHS_MM)

            # Rows: one per license
            rows = []
            for lic in group_licenses:
                base_vals = [_fmt_basic(getter(lic)) for _, getter in self.BASE_COLS]

                # Aggregate per item (sum numerics; first non-empty HSN/Desc)
                agg = defaultdict(lambda: {
                    "hsn": "",
                    "desc": "",
                    "qty": 0.0,
                    "deb_qty": 0.0, "deb_val": 0.0,
                    "all_qty": 0.0, "all_val": 0.0,
                    "avail_qty": 0.0,
                })

                for imp in lic.import_license.all():
                    hsn = getattr(getattr(imp, "hs_code", None), "hs_code", "") or ""
                    desc = (imp.description or "").strip()

                    qty = _to_f(getattr(imp, "quantity", 0))
                    deb_qty = _to_f(getattr(imp, "debited_quantity", 0))
                    deb_val = _to_f(getattr(imp, "debited_value", 0))
                    all_qty = _to_f(getattr(imp, "allotted_quantity", 0))
                    all_val = _to_f(getattr(imp, "allotted_value", 0))
                    avail_qty = _to_f(getattr(imp, "available_quantity", 0))

                    for it in imp.items.all():
                        name = (it.name or "").strip()
                        if not name:
                            continue
                        row = agg[name]
                        row["qty"] += qty
                        row["deb_qty"] += deb_qty
                        row["deb_val"] += deb_val
                        row["all_qty"] += all_qty
                        row["all_val"] += all_val
                        row["avail_qty"] += avail_qty
                        if not row["hsn"] and hsn:
                            row["hsn"] = hsn
                        if not row["desc"] and desc:
                            row["desc"] = desc

                dyn_vals = []
                for item in item_names:
                    a = agg.get(item)
                    if not a:
                        dyn_vals.extend([""] * len(self.ITEM_SUBCOLS))
                    else:
                        dyn_vals.extend([
                            a["hsn"],
                            a["desc"],
                            _fmt_qty(a["qty"]),
                            _fmt_qty(a["deb_qty"]),
                            _fmt_val(a["deb_val"]),
                            _fmt_qty(a["all_qty"]),
                            _fmt_val(a["all_val"]),
                            _fmt_qty(a["avail_qty"]),
                        ])

                rows.append(base_vals + dyn_vals)

            table = _table([headers] + rows, [w * mm for w in col_widths_mm], header_style, cell_style)
            elements.append(KeepTogether(table))

        # Footer
        def _footer(canvas, doc_):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.drawString(doc_.leftMargin, 10 * mm, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            canvas.drawRightString(doc_.pagesize[0] - doc_.rightMargin, 10 * mm, f"Page {doc_.page}")
            canvas.restoreState()

        doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)

        pdf = buf.getvalue()
        buf.close()

        filename = f"licenses_merged_norm_matrix_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{filename}"'  # open in browser
        return resp


# ----------------- helpers -----------------
def _fmt_basic(val):
    if val is None:
        return ""
    if isinstance(val, dt):
        return val.strftime("%Y-%m-%d %H:%M")
    if isinstance(val, date):
        return val.strftime("%Y-%m-%d")
    try:
        from decimal import Decimal
        if isinstance(val, (int, float, Decimal)):
            return f"{float(val):.2f}"
    except Exception:
        pass
    return str(val)


def _fmt_qty(x):
    try:
        xf = float(x or 0)
        return f"{xf:.4f}" if xf else ""
    except Exception:
        return ""


def _fmt_val(x):
    try:
        xf = float(x or 0)
        return f"{xf:.2f}" if xf else ""
    except Exception:
        return ""


def _to_f(x):
    try:
        return float(x or 0)
    except Exception:
        return 0.0


def _norm_codes_for_license(lic):
    """
    Return unique norm codes for a license; 'No Norm' if none/blank.
    A license with multiple export items/norms appears in multiple groups.
    """
    codes, seen = [], set()
    exports = getattr(lic, "export_license", []).all()
    if not exports:
        return ["No Norm"]

    found_any = False
    for ei in exports:
        norm = getattr(ei, "norm_class", None)
        code = ""
        if norm is not None:
            code = getattr(norm, "norm_class", None) or getattr(norm, "code", None) or ""
        if code:
            found_any = True
        if not code:
            code = "No Norm"
        if code not in seen:
            seen.add(code)
            codes.append(code)

    if not found_any and "No Norm" not in seen:
        codes.append("No Norm")
    return codes


def _item_names_for_licenses(lics):
    """Union of unique M2M item names across provided licenses (alphabetical)."""
    names = OrderedDict()
    for lic in lics:
        for imp in getattr(lic, "import_license", []).all():
            for it in imp.items.all():
                nm = (it.name or "").strip()
                if nm:
                    names[nm] = True
    return list(sorted(names.keys(), key=str.lower))


def _table(rows, col_widths, header_style, cell_style):
    """Build a styled ReportLab Table (first row is header)."""
    data = []
    for r_idx, row in enumerate(rows):
        out = []
        for val in row:
            txt = "" if val is None else str(val)
            style = header_style if r_idx == 0 else cell_style
            out.append(Paragraph(txt, style))
        data.append(out)

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2F5597")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return tbl
