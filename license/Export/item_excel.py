# license/views_xlsx.py
from datetime import date as _date
from io import BytesIO

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.views import View
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

from license.models import LicenseDetailsModel


class LicenseImportItemsXLSX(View):
    """
    XLSX export with:
      • License fields only on first row per license (includes License No. and FOB INR)
      • Base row per import item (BOE cells blank)
      • Extra rows:
          - Allotments with NO BOE → text in 'Allotments (No BOE)'
          - Each BOE (linked or not) → one row in BOE columns
      • BOE adds: % Premium, Premium per Kg, Premium Amount (Qty*PerKg else %*CIF INR)
      • New columns: FOB INR, Purchase Amount, Net Profit/Loss
      • After each license: two summary rows
          1) Debited totals (CIF FC, CIF INR)
          2) Premium Total and Net Profit/Loss = Premium Total − Purchase Amount
      • NEW: Alternating background color per license block (banded by license)
    """

    # ---------------- Queryset ----------------
    def get_queryset(self, request):
        g = request.GET
        qs = (
            LicenseDetailsModel.objects
            .select_related("exporter", "port")
            .prefetch_related(
                "export_license",
                "import_license",
                # allotments for each import item
                "import_license__allotment_details",
                "import_license__allotment_details__allotment",
                "import_license__allotment_details__allotment__company",
                "import_license__allotment_details__allotment__related_company",
                "import_license__allotment_details__allotment__bill_of_entry",
                # BOE item rows for each import item (+ their BOEs)
                "import_license__item_details",
                "import_license__item_details__bill_of_entry",
            )
            .order_by("license_expiry_date", "license_number")
        )

        s = (g.get("search") or "").strip()
        if s:
            qs = qs.filter(
                Q(license_number__icontains=s) |
                Q(file_number__icontains=s) |
                Q(exporter__name__icontains=s) |
                Q(port__name__icontains=s)
            )
        if g.get("exporter"):
            qs = qs.filter(exporter_id=g["exporter"])
        if g.get("port"):
            qs = qs.filter(port_id=g["port"])
        if g.get("purchase_status"):
            qs = qs.filter(purchase_status=g["purchase_status"])
        if g.get("active") in ("0", "1"):
            qs = qs.filter(is_active=(g["active"] == "1"))
        if g.get("expired") == "1":
            qs = qs.filter(license_expiry_date__lt=timezone.localdate())
        if g.get("from"):
            qs = qs.filter(license_date__gte=g["from"])
        if g.get("to"):
            qs = qs.filter(license_date__lte=g["to"])
        return qs

    # ---------------- Helpers ----------------
    def _norm_classes_from_export(self, lic):
        values = []
        rel = getattr(lic, "export_license", None)
        for ei in (rel.all() if rel is not None else []):
            val = (
                    str(getattr(ei, "norm_class_name", "") or "") or
                    str(getattr(getattr(ei, "norm_class", None), "name", "") or getattr(ei, "norm_class", "") or "")
            )
            if val and val not in values:
                values.append(val)
        return ", ".join(values)

    def _sum_fob_inr_from_export(self, lic):
        total = 0.0
        found = False
        rel = getattr(lic, "export_license", None)
        if not rel:
            return None
        candidates = (
            "fob_inr", "fob_value_inr", "fob_amount_inr", "fobInr", "FOB_INR",
            "value_inr", "inr_value",
        )
        for ei in rel.all():
            for fld in candidates:
                if hasattr(ei, fld):
                    v = getattr(ei, fld)
                    if v is not None:
                        try:
                            total += float(v)
                            found = True
                        except Exception:
                            pass
                    break
        return round(total, 2) if found else None

    def _hs_code_of(self, ii):
        for fld in ("hs_code", "hsn_code", "hscode"):
            if hasattr(ii, fld):
                obj = getattr(ii, fld)
                if obj:
                    if hasattr(obj, "code"):
                        return getattr(obj, "code") or getattr(obj, "name", "") or str(obj)
                    if hasattr(obj, "name"):
                        return getattr(obj, "name") or str(obj)
                    return str(obj)
        return ""

    def _desc_of(self, ii):
        for fld in ("description", "item_description", "name"):
            if hasattr(ii, fld) and getattr(ii, fld):
                return str(getattr(ii, fld))
        if hasattr(ii, "item") and ii.item:
            return getattr(ii.item, "name", "") or str(ii.item)
        return ""

    def _qty_of(self, ii):
        for fld in ("quantity", "qty", "import_quantity", "balance_qty"):
            if hasattr(ii, fld):
                v = getattr(ii, fld)
                if v is not None:
                    try:
                        return round(float(v), 2)
                    except Exception:
                        return v
        return None

    def _opening_cif_of(self, lic):
        v = getattr(lic, "opening_balance", None)
        if v is not None:
            try:
                return round(float(v), 2)
            except Exception:
                return v
        return None

    def _purchase_amount_of(self, lic):
        for fld in ("purchase_amount", "purchase_value", "purchase_inr"):
            if hasattr(lic, fld):
                v = getattr(lic, fld)
                if v is not None:
                    try:
                        return round(float(v), 2)
                    except Exception:
                        return v
        return None

    def _extra_wastage_of(self, ai):
        for fld in ("extra_wastage", "wastage_qty", "waste_qty"):
            if hasattr(ai, fld):
                v = getattr(ai, fld)
                if v is not None:
                    try:
                        return round(float(v), 2)
                    except Exception:
                        return v
        return None

    def _allotment_line(self, ai):
        allo = ai.allotment
        qty = ai.qty if ai.qty is not None else ""
        cif_fc = ai.cif_fc if ai.cif_fc is not None else ""
        company = getattr(getattr(allo, "company", None), "name", "") or ""
        extra = self._extra_wastage_of(ai)
        parts = [
            f"Qty {qty:.2f}" if isinstance(qty, (float, int)) else f"Qty {qty}",
            f"CIF.FC {cif_fc:.2f}" if isinstance(cif_fc, (float, int)) else f"CIF.FC {cif_fc}",
            f"Co {company}" if company else "",
            f"Extra {extra:.2f}" if isinstance(extra, (float, int)) else (f"Extra {extra}" if extra else ""),
        ]
        return " | ".join([p for p in parts if p])

    def _boe_company_name(self, boe):
        for attr in ("company", "importer", "exporter", "consignee", "vendor"):
            obj = getattr(boe, attr, None)
            if obj:
                name = getattr(obj, "name", None) or str(obj)
                if name:
                    return name
        for attr in ("company_name", "importer_name", "exporter_name", "consignee_name", "vendor_name"):
            val = getattr(boe, attr, None)
            if val:
                return str(val)
        return ""

    def _build_boe_list_for_item(self, lic, ii):
        boe_map = {}

        rd_list = list(getattr(ii, "item_details").all()) if hasattr(ii, "item_details") else []
        for rd in rd_list:
            boe = getattr(rd, "bill_of_entry", None)
            if not boe:
                continue
            bid = getattr(boe, "id", None)
            comp = self._boe_company_name(boe)
            if bid not in boe_map:
                boe_map[bid] = {
                    "no": getattr(boe, "bill_of_entry_number", "") or "",
                    "date": getattr(boe, "bill_of_entry_date", None),
                    "company": comp,
                    "qty": 0.0,
                    "cif_fc": 0.0,
                    "cif_inr": 0.0,
                }
            for attr, key in (("qty", "qty"), ("cif_fc", "cif_fc"), ("cif_inr", "cif_inr")):
                try:
                    boe_map[bid][key] += float(getattr(rd, attr, 0) or 0)
                except Exception:
                    pass
            if not boe_map[bid]["company"] and comp:
                boe_map[bid]["company"] = comp

        allotment_items = list(getattr(ii, "allotment_details").all())
        for ai in allotment_items:
            allo = ai.allotment
            if hasattr(allo, "bill_of_entry"):
                for boe in allo.bill_of_entry.all():
                    bid = getattr(boe, "id", None)
                    comp = self._boe_company_name(boe)
                    if bid not in boe_map:
                        boe_map[bid] = {
                            "no": getattr(boe, "bill_of_entry_number", "") or "",
                            "date": getattr(boe, "bill_of_entry_date", None),
                            "company": comp,
                            "qty": None,
                            "cif_fc": None,
                            "cif_inr": None,
                        }
                    elif not boe_map[bid]["company"] and comp:
                        boe_map[bid]["company"] = comp

        def _sort_key(v):
            d = v["date"]
            return (d or _date.min, v["no"])

        return sorted(boe_map.values(), key=_sort_key)

    # ---------------- Build XLSX ----------------
    def get(self, request, *args, **kwargs):
        wb = Workbook()
        ws = wb.active
        ws.title = "License Import Items"

        # Column map
        COLS = {
            "lic_no": 1, "expiry": 2, "exporter": 3, "norms": 4, "open_cif": 5, "bal_cif": 6,
            "fob_inr": 7, "purchase": 8, "hs": 9, "desc": 10, "qty": 11, "allot": 12,
            "boe_no": 13, "boe_date": 14, "boe_comp": 15, "boe_qty": 16,
            "boe_cif_fc": 17, "boe_cif_inr": 18, "boe_pct": 19, "boe_perkg": 20,
            "boe_prem": 21, "net_pl": 22,
        }

        header = [
            "License No.",
            "License Expiry Date",
            "License Exporter",
            "License Norms",
            "License Opening CIF",
            "License Balance CIF",
            "FOB INR",
            "Purchase Amount",
            "HS Code",
            "Description",
            "Quantity",
            "Allotments (No BOE)",
            "BOE No.",
            "BOE Date",
            "BOE Company",
            "BOE Qty",
            "BOE CIF FC",
            "BOE CIF INR",
            "% Premium",
            "Premium per Kg",
            "Premium Amount",
            "Net Profit/Loss",
        ]

        # Styles
        header_font = Font(name="Calibri", size=11, bold=True)
        body_font = Font(name="Calibri", size=10)
        fill_header = PatternFill("solid", fgColor="F2F2F2")
        fill_total = PatternFill("solid", fgColor="FFF4CC")  # totals highlight

        # License band fills (alternate per license)
        fill_band_a = PatternFill("solid", fgColor="F7FBFF")  # very light blue
        fill_band_b = PatternFill("solid", fgColor="FDF7FF")  # very light lilac

        thin = Side(style="thin", color="BFBFBF")
        border_all = Border(left=thin, right=thin, top=thin, bottom=thin)

        al_left = Alignment(vertical="top", wrap_text=True)
        al_right = Alignment(vertical="top", horizontal="right", wrap_text=True)
        al_center = Alignment(vertical="top", horizontal="center", wrap_text=True)

        # Header
        ws.append(header)
        for col in range(1, len(header) + 1):
            c = ws.cell(row=1, column=col)
            c.font = header_font
            c.fill = fill_header
            c.border = border_all
            c.alignment = al_center

        def style_row(r, band_fill, numeric_cols=()):
            """Apply fonts/borders/alignment and band fill to row r."""
            for c in range(1, len(header) + 1):
                cell = ws.cell(row=r, column=c)
                cell.font = body_font
                cell.border = border_all
                # number formats
                if c in numeric_cols:
                    cell.alignment = al_right
                    # percent col special case
                    if c == COLS["boe_pct"]:
                        cell.number_format = "0.00%"
                    else:
                        if isinstance(cell.value, (float, int)):
                            cell.number_format = "0.00"
                else:
                    cell.alignment = al_left
                # apply band fill
                cell.fill = band_fill

        row_idx = 2
        qs = self.get_queryset(request)
        band_toggle = False  # flips for each license

        for lic in qs:
            # choose band color for this license
            band_toggle = not band_toggle
            band_fill = fill_band_a if band_toggle else fill_band_b

            norms = self._norm_classes_from_export(lic)
            bal_cif = getattr(lic, "get_balance_cif", None)
            bal_cif_val = bal_cif() if callable(bal_cif) else getattr(lic, "get_balance_cif", None)
            try:
                bal_cif_val = round(float(bal_cif_val), 2) if bal_cif_val is not None else None
            except Exception:
                pass
            open_cif_val = self._opening_cif_of(lic)
            purchase_val = self._purchase_amount_of(lic)
            fob_inr_val = self._sum_fob_inr_from_export(lic)
            exporter_name = getattr(getattr(lic, "exporter", None), "name", "") or ""
            license_number = getattr(lic, "license_number", "") or ""

            items = list(lic.import_license.all() if hasattr(lic, "import_license") else [])
            license_first_row = None
            boe_rows_for_license = []

            for idx, ii in enumerate(items):
                # base row
                expiry_str = lic.license_expiry_date.strftime("%d-%b-%Y") if getattr(lic, "license_expiry_date",
                                                                                     None) and idx == 0 else ""
                row = [""] * len(header)
                row[COLS["lic_no"] - 1] = license_number if idx == 0 else ""
                row[COLS["expiry"] - 1] = expiry_str
                row[COLS["exporter"] - 1] = exporter_name if idx == 0 else ""
                row[COLS["norms"] - 1] = norms if idx == 0 else ""
                row[COLS["open_cif"] - 1] = open_cif_val if idx == 0 else None
                row[COLS["bal_cif"] - 1] = bal_cif_val if idx == 0 else None
                row[COLS["fob_inr"] - 1] = fob_inr_val if idx == 0 else None
                row[COLS["purchase"] - 1] = purchase_val if idx == 0 else None
                row[COLS["hs"] - 1] = self._hs_code_of(ii)
                row[COLS["desc"] - 1] = self._desc_of(ii)
                row[COLS["qty"] - 1] = self._qty_of(ii)

                ws.append(row)
                style_row(
                    row_idx,
                    band_fill,
                    numeric_cols=(
                        COLS["open_cif"], COLS["bal_cif"], COLS["fob_inr"], COLS["purchase"],
                        COLS["qty"], COLS["boe_qty"], COLS["boe_cif_fc"], COLS["boe_cif_inr"],
                        COLS["boe_prem"], COLS["boe_pct"], COLS["boe_perkg"]
                    ),
                )
                if idx == 0:
                    license_first_row = row_idx
                row_idx += 1

                # allotments with NO BOE
                allotment_items = list(getattr(ii, "allotment_details").all())
                for ai in allotment_items:
                    allo = ai.allotment
                    has_boe = hasattr(allo, "bill_of_entry") and allo.bill_of_entry.exists()
                    if not has_boe:
                        line = self._allotment_line(ai)
                        ws.append([""] * (COLS["allot"] - 1) + [line] + [""] * (len(header) - COLS["allot"]))
                        style_row(
                            row_idx,
                            band_fill,
                            numeric_cols=(COLS["open_cif"], COLS["bal_cif"], COLS["fob_inr"], COLS["purchase"],
                                          COLS["qty"])
                        )
                        row_idx += 1

                # BOE rows
                boe_list = self._build_boe_list_for_item(lic, ii)
                for v in boe_list:
                    date_str = v["date"].strftime("%d-%b-%Y") if v["date"] else ""
                    ws.append([""] * (COLS["boe_no"] - 1) + [
                        v["no"],
                        date_str,
                        v["company"],
                        v["qty"],
                        v["cif_fc"],
                        v["cif_inr"],
                        0,  # % Premium
                        0,  # Premium per Kg
                        None,  # Premium Amount (formula below)
                        "",  # Net P/L (summary rows only)
                    ])
                    # number formats & band fill
                    style_row(
                        row_idx,
                        band_fill,
                        numeric_cols=(COLS["boe_qty"], COLS["boe_cif_fc"], COLS["boe_cif_inr"], COLS["boe_pct"],
                                      COLS["boe_perkg"], COLS["boe_prem"]),
                    )
                    # Premium Amount = IF(PerKg>0, Qty*PerKg, IF(%>0, %*CIF_INR, 0))
                    r = row_idx
                    qty_cell = f"{get_column_letter(COLS['boe_qty'])}{r}"
                    perkg_cell = f"{get_column_letter(COLS['boe_perkg'])}{r}"
                    pct_cell = f"{get_column_letter(COLS['boe_pct'])}{r}"
                    cif_inr_cell = f"{get_column_letter(COLS['boe_cif_inr'])}{r}"
                    prem_cell = ws.cell(row=r, column=COLS["boe_prem"])
                    prem_cell.value = (
                        f"=IF({perkg_cell}>0,{qty_cell}*{perkg_cell},IF({pct_cell}>0,{cif_inr_cell}*{pct_cell},0))"
                    )
                    prem_cell.number_format = "0.00"
                    boe_rows_for_license.append(row_idx)
                    row_idx += 1

            # ---- Summary rows (kept in yellow, not banded) ----
            if boe_rows_for_license:
                r1, rN = boe_rows_for_license[0], boe_rows_for_license[-1]
                col_fc = get_column_letter(COLS["boe_cif_fc"])
                col_inr = get_column_letter(COLS["boe_cif_inr"])
                col_prem = get_column_letter(COLS["boe_prem"])

                # Debited totals
                ws.append([""] * len(header))
                r_tot1 = row_idx
                ws.cell(row=r_tot1, column=COLS["lic_no"]).value = "Debited Totals"
                ws.cell(row=r_tot1, column=COLS["boe_cif_fc"]).value = f"=SUM({col_fc}{r1}:{col_fc}{rN})"
                ws.cell(row=r_tot1, column=COLS["boe_cif_inr"]).value = f"=SUM({col_inr}{r1}:{col_inr}{rN})"
                for c in range(1, len(header) + 1):
                    cell = ws.cell(row=r_tot1, column=c)
                    cell.font = Font(name="Calibri", size=10, bold=True)
                    cell.fill = fill_total
                    cell.border = border_all
                    cell.alignment = al_right if c in (COLS["boe_cif_fc"], COLS["boe_cif_inr"]) else al_left
                row_idx += 1

                # Premium total + Net P/L
                ws.append([""] * len(header))
                r_tot2 = row_idx
                ws.cell(row=r_tot2, column=COLS["lic_no"]).value = "Premium & Net"
                ws.cell(row=r_tot2, column=COLS["boe_prem"]).value = f"=SUM({col_prem}{r1}:{col_prem}{rN})"
                prem_total_cell = f"{get_column_letter(COLS['boe_prem'])}{r_tot2}"
                purch_cell = f"{get_column_letter(COLS['purchase'])}{license_first_row}" if license_first_row else "0"
                ws.cell(row=r_tot2, column=COLS["net_pl"]).value = f"=IFERROR({prem_total_cell}-{purch_cell},\"\")"
                for c in range(1, len(header) + 1):
                    cell = ws.cell(row=r_tot2, column=c)
                    cell.font = Font(name="Calibri", size=10, bold=True)
                    cell.fill = fill_total
                    cell.border = border_all
                    if c in (COLS["boe_prem"], COLS["net_pl"], COLS["purchase"]):
                        cell.alignment = al_right
                        cell.number_format = "0.00"
                    else:
                        cell.alignment = al_left
                row_idx += 1

        # Column widths
        widths = {
            1: 22, 2: 18, 3: 28, 4: 28, 5: 16, 6: 16, 7: 16, 8: 18, 9: 14,
            10: 40, 11: 12, 12: 48, 13: 18, 14: 14, 15: 32, 16: 12, 17: 14,
            18: 14, 19: 12, 20: 14, 21: 16, 22: 18,
        }
        for idx, w in widths.items():
            ws.column_dimensions[get_column_letter(idx)].width = w

        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(header))}1"

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        resp = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = (
            f'inline; filename="LicenseImportItems_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
        )
        return resp
