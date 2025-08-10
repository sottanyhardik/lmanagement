# license/Export/excel.py
from collections import defaultdict, OrderedDict
from datetime import date, datetime as dt
from io import BytesIO

from django.db.models import Prefetch
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from rest_framework.views import APIView

from license.models import (
    LicenseDetailsModel,
    LicenseImportItemsModel,
    LicenseExportItemModel,  # adjust import path/name if different
)


class LicenseExportXlsxMergedByNormView(APIView):
    """
    XLSX: Group licenses by SION norm; one sheet per norm.

    Columns = fixed license fields + (per unique M2M item) subcolumns:
      HSN | Description | Quantity | Debited Qty | Debited Value | Allotted Qty | Allotted Value | Available Qty
    Rows = licenses belonging to that norm (a license can appear in multiple sheets if it has multiple norms).
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

    # Per-item subcolumns (order matters)
    ITEM_SUBCOLS = [
        ("HSN", "hsn", "text"),
        ("Description", "desc", "text"),
        ("Quantity", "qty", "qty"),
        ("Debited Qty", "deb_qty", "qty"),
        ("Debited Value", "deb_val", "val"),
        ("Allotted Qty", "all_qty", "qty"),
        ("Allotted Value", "all_val", "val"),
        ("Available Qty", "avail_qty", "qty"),
    ]

    def get(self, request, *args, **kwargs):
        # ----- Queryset with prefetch -----
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

        # ----- Group licenses by norm (with "No Norm") -----
        groups = defaultdict(list)
        for lic in licenses:
            for code in _norm_codes_for_license(lic):
                groups[code].append(lic)

        if not groups:
            return HttpResponse(b"No data", content_type="text/plain")

        # "No Norm" last
        norm_codes_sorted = sorted(groups.keys(), key=lambda x: (x == "No Norm", x.lower()))

        # ----- Workbook and simple styles (no NamedStyle) -----
        wb = Workbook()
        wb.remove(wb.active)

        header_fill = PatternFill("solid", fgColor="2F5597")
        header_font = Font(bold=True, color="FFFFFF")
        header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        text_wrap = Alignment(wrap_text=True, vertical="top")

        # ----- Build each sheet -----
        for code in norm_codes_sorted:
            lics = groups[code]
            item_names = _item_names_for_licenses(lics)  # dynamic items for this norm group

            ws = wb.create_sheet(title=_safe_sheet_title(f"{code} ({len(lics)})"))

            # Header row = base cols + per item subcols
            headers = [t for t, _ in self.BASE_COLS]
            for item in item_names:
                for sub_title, _, _ in self.ITEM_SUBCOLS:
                    headers.append(f"{item} — {sub_title}")
            ws.append(headers)

            # Style header
            for c in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=c)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = header_align

            # Freeze header row
            ws.freeze_panes = "A2"

            # Data rows
            for lic in lics:
                row_vals = []

                # base cols
                for _, getter in self.BASE_COLS:
                    try:
                        val = getter(lic)
                    except Exception:
                        val = ""
                    row_vals.append(_fmt_basic(val))

                # aggregate per item (sum numerics; first non-empty HSN/Desc)
                agg = defaultdict(lambda: {
                    "hsn": "",
                    "desc": "",
                    "qty": 0.0,
                    "deb_qty": 0.0, "deb_val": 0.0,
                    "all_qty": 0.0, "all_val": 0.0,
                    "avail_qty": 0.0,
                })

                for imp in _iter_related(lic, "import_license"):
                    hsn = getattr(getattr(imp, "hs_code", None), "hs_code", "") or ""
                    desc = (imp.description or "").strip()

                    qty = _to_f(getattr(imp, "quantity", 0))
                    deb_qty = _to_f(getattr(imp, "debited_quantity", 0))
                    deb_val = _to_f(getattr(imp, "debited_value", 0))
                    all_qty = _to_f(getattr(imp, "allotted_quantity", 0))
                    all_val = _to_f(getattr(imp, "allotted_value", 0))
                    avail_qty = _to_f(getattr(imp, "available_quantity", 0))

                    for it in getattr(imp, "items", []).all():
                        name = (it.name or "").strip()
                        if not name:
                            continue
                        a = agg[name]
                        a["qty"] += qty
                        a["deb_qty"] += deb_qty
                        a["deb_val"] += deb_val
                        a["all_qty"] += all_qty
                        a["all_val"] += all_val
                        a["avail_qty"] += avail_qty
                        if not a["hsn"] and hsn:
                            a["hsn"] = hsn
                        if not a["desc"] and desc:
                            a["desc"] = desc

                # dynamic block cells
                for item in item_names:
                    a = agg.get(item)
                    if not a:
                        row_vals.extend([""] * len(self.ITEM_SUBCOLS))
                    else:
                        row_vals.extend([
                            a["hsn"],
                            a["desc"],
                            a["qty"],
                            a["deb_qty"],
                            a["deb_val"],
                            a["all_qty"],
                            a["all_val"],
                            a["avail_qty"],
                        ])

                ws.append(row_vals)

            # Apply formats (dates, qty/value number formats, wrap text)
            _apply_formats(ws, base_cols=self.BASE_COLS, item_subcols=self.ITEM_SUBCOLS, text_wrap=text_wrap)

            # Auto-size columns
            _autosize(ws, max_width=55, min_width=10)

        # ----- Stream response -----
        out = BytesIO()
        wb.save(out)
        out.seek(0)
        filename = f"licenses_merged_norm_matrix_{dt.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        resp = HttpResponse(
            out.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp


# ---------------- helpers ----------------

def _iter_related(obj, attr):
    """
    Uniformly iterate a related manager or a plain list/None.
    """
    rel = getattr(obj, attr, None)
    if rel is None:
        return []
    try:
        # RelatedManager
        return rel.all()
    except Exception:
        # Already a list/iterable
        return rel or []


def _fmt_basic(val):
    """
    Keep native types where possible so Excel formats apply:
    - date/datetime: leave as is, we set number_format on the column
    - numeric: return float
    - other: str
    """
    if val is None:
        return ""
    if isinstance(val, dt) or isinstance(val, date):
        return val
    try:
        from decimal import Decimal
        if isinstance(val, (int, float, Decimal)):
            return float(val)
    except Exception:
        pass
    return str(val)


def _to_f(x):
    try:
        return float(x or 0)
    except Exception:
        return 0.0


def _item_names_for_licenses(lics):
    """Alphabetical unique M2M item names across licenses."""
    names = OrderedDict()
    for lic in lics:
        for imp in _iter_related(lic, "import_license"):
            for it in getattr(imp, "items", []).all():
                nm = (it.name or "").strip()
                if nm:
                    names[nm] = True
    return list(sorted(names.keys(), key=str.lower))


def _norm_codes_for_license(lic):
    """
    Unique norm codes; returns ['No Norm'] when none/blank.
    A license with multiple export items/norms appears in multiple groups.
    """
    codes, seen = [], set()
    exports = _iter_related(lic, "export_license")
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


def _apply_formats(ws, base_cols, item_subcols, text_wrap: Alignment):
    """
    Apply cell formats:
      - Base date columns => yyyy-mm-dd
      - 'Balance CIF' => 0.00
      - Dynamic per item subcolumns: qty => 0.0000, val => 0.00, text => wrap
    """
    if ws.max_row < 2:
        return

    header_map = {ws.cell(row=1, column=c).value: c for c in range(1, ws.max_column + 1)}

    # Base formats
    col_license_date = header_map.get("License Date")
    col_expiry_date = header_map.get("Expiry Date")
    col_balance_cif = header_map.get("Balance CIF")

    for r in range(2, ws.max_row + 1):
        if col_license_date:
            ws.cell(row=r, column=col_license_date).number_format = "yyyy-mm-dd"
        if col_expiry_date:
            ws.cell(row=r, column=col_expiry_date).number_format = "yyyy-mm-dd"
        if col_balance_cif:
            ws.cell(row=r, column=col_balance_cif).number_format = "0.00"

    # Dynamic region starts after base columns
    base_count = len(base_cols)
    sub_count = len(item_subcols)
    # Each block: HSN(text), Desc(text), Qty(qty), DebQty(qty), DebVal(val), AllQty(qty), AllVal(val), AvailQty(qty)
    for c in range(base_count + 1, ws.max_column + 1):
        header = ws.cell(row=1, column=c).value or ""
        # Decide kind based on subcolumn suffix
        if header.endswith(" — Description"):
            for r in range(2, ws.max_row + 1):
                ws.cell(row=r, column=c).alignment = text_wrap
        elif header.endswith(" — HSN"):
            # leave as text
            for r in range(2, ws.max_row + 1):
                ws.cell(row=r, column=c).alignment = text_wrap
        elif header.endswith(" — Debited Value") or header.endswith(" — Allotted Value"):
            for r in range(2, ws.max_row + 1):
                ws.cell(row=r, column=c).number_format = "0.00"
        elif (
                header.endswith(" — Quantity")
                or header.endswith(" — Debited Qty")
                or header.endswith(" — Allotted Qty")
                or header.endswith(" — Available Qty")
        ):
            for r in range(2, ws.max_row + 1):
                ws.cell(row=r, column=c).number_format = "0.0000"


def _autosize(ws, max_width=55, min_width=10):
    """Auto-size worksheet columns based on simple content length heuristic."""
    for col_idx in range(1, ws.max_column + 1):
        col_letter = get_column_letter(col_idx)
        max_len = 0
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=col_idx, max_col=col_idx):
            val = row[0].value
            if val is None:
                continue
            s = str(val)
            # Headers & long descriptions get a little extra slack
            length = len(s) + (2 if row[0].row == 1 else 0)
            max_len = max(max_len, length)
        width = min(max(min_width, max_len + 1), max_width)
        ws.column_dimensions[col_letter].width = width


def _safe_sheet_title(title: str) -> str:
    # Excel constraints: <=31 chars; forbid : \ / ? * [ ]
    bad = set(':\\/?*[]')
    t = "".join(ch for ch in title if ch not in bad)
    return t[:31] if len(t) > 31 else t
