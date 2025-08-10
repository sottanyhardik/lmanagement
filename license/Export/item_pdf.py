# license/views_reportlab.py
from datetime import date as _date
from html import escape as html_escape
from io import BytesIO

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.views import View
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Table as RLTable,
    TableStyle as RLTableStyle,
)

from license.models import LicenseDetailsModel


class LicenseImportItemsUltraWidePDF(View):
    """
    One ultra-wide table:
      • License details only on first row per license
      • For each import item:
          - Allotments with NO BOE show as extra lines in 'Allotments (No BOE)'
          - BOEs (linked or not) shown as a compact mini-table embedded IN THE SAME ROW,
            spanning columns 9..14: [BOE No. | BOE Date | BOE Company | BOE Qty | BOE CIF FC | BOE CIF INR]
            (rows capped to MAX_BOE_ROWS per item; adds “+N more” line if truncated)
    """

    MAX_BOE_ROWS = 8  # increase/decrease to allow more/less BOE rows in-cell

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

    # ---------------- Styles & utils ----------------
    def _styles(self):
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="Cell", fontName="Helvetica", fontSize=9, leading=11))
        styles.add(ParagraphStyle(name="CellRight", parent=styles["Cell"], alignment=2))  # TA_RIGHT
        styles.add(ParagraphStyle(name="TitleBold", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14,
                                  leading=16))
        styles.add(
            ParagraphStyle(name="MiniHead", parent=styles["Cell"], fontName="Helvetica-Bold", fontSize=8, leading=10))
        styles.add(ParagraphStyle(name="MiniCell", parent=styles["Cell"], fontSize=8, leading=10))
        styles.add(ParagraphStyle(name="MiniCellRight", parent=styles["CellRight"], fontSize=8, leading=10))
        styles.add(ParagraphStyle(name="Muted", parent=styles["MiniCell"], textColor=colors.grey))
        return styles

    def _p(self, text, style):
        return Paragraph("" if text is None else str(text), style)

    def _measure_col_widths(self, rows, font_name="Helvetica", font_size=9, pad=8, clamp_max=2000):
        """
        Measure natural widths for plain-string rows (no nested flowables).
        """
        stringWidth = pdfmetrics.stringWidth
        widths = [0.0] * len(rows[0])
        for r in rows:
            for c, txt in enumerate(r):
                txt = txt or ""
                if "\n" in txt:
                    longest = max((len(line), line) for line in txt.split("\n"))[1]
                else:
                    longest = txt
                w = stringWidth(longest, font_name, font_size) + pad
                widths[c] = max(widths[c], w)
        return [max(30, min(w, clamp_max)) for w in widths]

    # ---- Norm Class from export items ----
    def _norm_classes_from_export(self, lic):
        values = []
        rel = getattr(lic, "export_license", None)
        for ei in (rel.all() if rel is not None else []):
            if getattr(ei, "norm_class_name", None):
                val = str(ei.norm_class_name)
            elif getattr(ei, "norm_class", None):
                nc = ei.norm_class
                val = getattr(nc, "name", None) or str(nc)
            else:
                val = None
            if val and val not in values:
                values.append(val)
        return ", ".join(values)

    # ---- Import item resolvers ----
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
                        return f"{float(v):.2f}"
                    except Exception:
                        return str(v)
        return ""

    def _opening_cif_of(self, lic):
        v = getattr(lic, "opening_balance", None)
        if v is not None:
            try:
                return f"{float(v):.2f}"
            except Exception:
                return str(v)
        return ""

    def _extra_wastage_of(self, allotment_item):
        for fld in ("extra_wastage", "wastage_qty", "waste_qty"):
            if hasattr(allotment_item, fld):
                v = getattr(allotment_item, fld)
                if v is not None:
                    try:
                        return f"{float(v):.2f}"
                    except Exception:
                        return str(v)
        return ""

    # ---- Allotment (no BOE) line text ----
    def _allotment_line(self, ai):
        allo = ai.allotment
        qty_str = f"{ai.qty:.2f}" if ai.qty is not None else ""
        cif_fc_str = f"{ai.cif_fc:.2f}" if ai.cif_fc is not None else ""
        company = getattr(getattr(allo, "company", None), "name", "") or ""
        extra = self._extra_wastage_of(ai)
        return f"Qty {qty_str} | CIF.FC {cif_fc_str} | Co {company}" + (f" | Extra {extra}" if extra else "")

    # ---- Resolve BOE company name from the BOE record itself ----
    def _boe_company_name(self, boe):
        # Try common foreign keys that might carry the company
        for attr in ("company", "importer", "exporter", "consignee", "vendor"):
            obj = getattr(boe, attr, None)
            if obj:
                name = getattr(obj, "name", None) or str(obj)
                if name:
                    return name
        # Try direct string fields if present
        for attr in ("company_name", "importer_name", "exporter_name", "consignee_name", "vendor_name"):
            val = getattr(boe, attr, None)
            if val:
                return str(val)
        return ""

    # ---- Build BOE dict for an item (companies from BOE only) ----
    def _build_boe_map_for_item(self, lic, ii):
        """
        boe_id -> {'no','date','qty','cif_fc','cif_inr','companies': set([...])}
        • Pull companies ONLY from the BOE record (not from allotment/exporter).
        • Include BOEs from item_details AND BOEs attached via allotments.
        """
        boe_map = {}

        # Direct BOE rows on this item
        rd_list = list(getattr(ii, "item_details").all()) if hasattr(ii, "item_details") else []
        for rd in rd_list:
            boe = getattr(rd, "bill_of_entry", None)
            if not boe:
                continue
            bid = getattr(boe, "id", None)
            comp_name = self._boe_company_name(boe)

            if bid not in boe_map:
                boe_map[bid] = {
                    "no": getattr(boe, "bill_of_entry_number", "") or "",
                    "date": getattr(boe, "bill_of_entry_date", None),
                    "qty": 0.0,
                    "cif_fc": 0.0,
                    "cif_inr": 0.0,
                    "companies": set([comp_name]) if comp_name else set(),
                }
            # accumulate item-level numbers
            for attr, key in (("qty", "qty"), ("cif_fc", "cif_fc"), ("cif_inr", "cif_inr")):
                try:
                    boe_map[bid][key] += float(getattr(rd, attr, 0) or 0)
                except Exception:
                    pass
            if comp_name:
                boe_map[bid]["companies"].add(comp_name)

        # BOEs attached via allotments (ensure presence; use company from BOE itself)
        allotment_items = list(getattr(ii, "allotment_details").all())
        for ai in allotment_items:
            allo = ai.allotment
            if hasattr(allo, "bill_of_entry"):
                for boe in allo.bill_of_entry.all():
                    bid = getattr(boe, "id", None)
                    comp_name = self._boe_company_name(boe)
                    if bid not in boe_map:
                        boe_map[bid] = {
                            "no": getattr(boe, "bill_of_entry_number", "") or "",
                            "date": getattr(boe, "bill_of_entry_date", None),
                            "qty": None,
                            "cif_fc": None,
                            "cif_inr": None,
                            "companies": set([comp_name]) if comp_name else set(),
                        }
                    elif comp_name:
                        boe_map[bid]["companies"].add(comp_name)

        return boe_map

    # ---- Create a compact BOE mini-table flowable ----
    def _boe_minitable(self, boe_map, styles):
        """
        Returns a small RLTable to be embedded in a single cell.
        Caps rows to MAX_BOE_ROWS and appends a '… +N more' line when truncated.
        """
        if not boe_map:
            return Paragraph("", styles["MiniCell"])

        def _sort_key(v):
            d = v["date"]
            return (d or _date.min, v["no"])

        ordered = [v for _, v in sorted(boe_map.items(), key=lambda kv: _sort_key(kv[1]))]
        shown = ordered[: self.MAX_BOE_ROWS]
        remaining = max(0, len(ordered) - len(shown))

        header = ["BOE No.", "BOE Date", "Company", "Qty", "CIF FC", "CIF INR"]
        data = [[Paragraph(h, styles["MiniHead"]) for h in header]]

        for v in shown:
            date_str = v["date"].strftime("%d-%b-%Y") if v["date"] else ""
            comp = ", ".join(sorted(v["companies"])) if v["companies"] else ""
            qty_str = "" if v["qty"] is None else f"{v['qty']:.2f}"
            cif_fc_str = "" if v["cif_fc"] is None else f"{v['cif_fc']:.2f}"
            cif_inr_str = "" if v["cif_inr"] is None else f"{v['cif_inr']:.2f}"
            data.append([
                Paragraph(html_escape(v["no"]), styles["MiniCell"]),
                Paragraph(date_str, styles["MiniCell"]),
                Paragraph(html_escape(comp), styles["MiniCell"]),
                Paragraph(qty_str, styles["MiniCellRight"]),
                Paragraph(cif_fc_str, styles["MiniCellRight"]),
                Paragraph(cif_inr_str, styles["MiniCellRight"]),
            ])

        if remaining:
            data.append([
                Paragraph(f"… +{remaining} more", styles["Muted"]),
                Paragraph("", styles["MiniCell"]),
                Paragraph("", styles["MiniCell"]),
                Paragraph("", styles["MiniCell"]),
                Paragraph("", styles["MiniCell"]),
                Paragraph("", styles["MiniCell"]),
            ])

        mini_widths = [105, 80, 160, 60, 75, 85]
        mini = RLTable(data, colWidths=mini_widths, repeatRows=1)
        mini.setStyle(RLTableStyle([
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.93, 0.93, 0.93)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
        ]))
        return mini

    # ---------------- Build ----------------
    def get(self, request, *args, **kwargs):
        styles = self._styles()
        qs = self.get_queryset(request)

        # Main table headers (BOE block spans cols 9..14 in item rows)
        header = [
            "License Expiry Date",  # 0
            "License Exporter",  # 1
            "License Norms",  # 2
            "License Opening CIF",  # 3
            "License Balance CIF",  # 4
            "HS Code",  # 5
            "Description",  # 6
            "Quantity",  # 7
            "Allotments (No BOE)",  # 8
            "BOE No.",  # 9
            "BOE Date",  # 10
            "BOE Company",  # 11
            "BOE Qty",  # 12
            "BOE CIF FC",  # 13
            "BOE CIF INR",  # 14
        ]

        plain_rows = [header[:]]
        rich_rows = [[self._p(h, styles["Cell"]) for h in header]]
        spans = []  # (c0, r0, c1, r1) SPANs for the BOE mini-table per item row

        for lic in qs:
            norm_classes = self._norm_classes_from_export(lic)
            bal_cif = lic.get_balance_cif() if callable(getattr(lic, 'get_balance_cif', None)) else getattr(lic,
                                                                                                            'get_balance_cif',
                                                                                                            0)
            bal_cif_str = f"{float(bal_cif):.2f}" if bal_cif is not None else ""
            opening_cif_str = self._opening_cif_of(lic)
            exporter_name = getattr(getattr(lic, "exporter", None), "name", "") or ""

            items = list(lic.import_license.all() if hasattr(lic, "import_license") else [])

            for idx, ii in enumerate(items):
                # ---- Main import item row (BOE mini-table embedded in this row)
                le = lic.license_expiry_date.strftime("%d-%b-%Y") if lic.license_expiry_date and idx == 0 else ""
                ex = exporter_name if idx == 0 else ""
                nc = norm_classes if idx == 0 else ""  # shown once per license
                oc = opening_cif_str if idx == 0 else ""
                bc = bal_cif_str if idx == 0 else ""

                hs = self._hs_code_of(ii)
                desc = self._desc_of(ii)
                qty = self._qty_of(ii)

                boe_map = self._build_boe_map_for_item(lic, ii)
                boe_cell = self._boe_minitable(boe_map, styles)

                row_idx = len(rich_rows)
                plain_rows.append([le, ex, nc, oc, bc, hs, desc, qty, "", "tbl", "", "", "", "", ""])
                rich_rows.append([
                    self._p(le, styles["Cell"]),  # 0
                    self._p(ex, styles["Cell"]),  # 1
                    self._p(nc, styles["Cell"]),  # 2
                    self._p(oc, styles["CellRight"]),  # 3
                    self._p(bc, styles["CellRight"]),  # 4
                    self._p(hs, styles["Cell"]),  # 5
                    self._p(desc, styles["Cell"]),  # 6
                    self._p(qty, styles["CellRight"]),  # 7
                    self._p("", styles["MiniCell"]),  # 8 (Allotments)
                    boe_cell,  # 9 (span to 14)
                    self._p("", styles["MiniCell"]),  # 10
                    self._p("", styles["MiniCell"]),  # 11
                    self._p("", styles["MiniCellRight"]),  # 12
                    self._p("", styles["MiniCellRight"]),  # 13
                    self._p("", styles["MiniCellRight"]),  # 14
                ])
                spans.append((9, row_idx, 14, row_idx))

                # ---- Extra rows: Allotments with NO BOE (single-line entries)
                allotment_items = list(getattr(ii, "allotment_details").all())
                for ai in allotment_items:
                    allo = ai.allotment
                    has_boe = hasattr(allo, "bill_of_entry") and allo.bill_of_entry.exists()
                    if not has_boe:
                        line = self._allotment_line(ai)
                        plain_rows.append([""] * 8 + [line] + [""] * 6)
                        rich_rows.append([
                            self._p("", styles["Cell"]),  # 0..7
                            self._p("", styles["Cell"]),
                            self._p("", styles["Cell"]),
                            self._p("", styles["CellRight"]),
                            self._p("", styles["CellRight"]),
                            self._p("", styles["Cell"]),
                            self._p("", styles["Cell"]),
                            self._p("", styles["CellRight"]),
                            self._p(line, styles["MiniCell"]),  # 8
                            self._p("", styles["MiniCell"]),  # 9..14 empty
                            self._p("", styles["MiniCell"]),
                            self._p("", styles["MiniCell"]),
                            self._p("", styles["MiniCellRight"]),
                            self._p("", styles["MiniCellRight"]),
                            self._p("", styles["MiniCellRight"]),
                        ])

        # Column widths & ultra-wide page
        widths = self._measure_col_widths(plain_rows)
        widths[6] = max(widths[6], 200)  # Description
        widths[8] = max(widths[8], 280)  # Allotments (No BOE)
        # BOE columns (spanned in item rows; keep decent header widths)
        widths[9] = max(widths[9], 110)
        widths[10] = max(widths[10], 80)
        widths[11] = max(widths[11], 160)
        widths[12] = max(widths[12], 60)
        widths[13] = max(widths[13], 75)
        widths[14] = max(widths[14], 85)

        left, right, top, bottom = 12 * mm, 12 * mm, 14 * mm, 16 * mm
        page_h = A4[1]
        page_w = sum(widths) + left + right  # ultra-wide

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=(page_w, page_h),
            leftMargin=left, rightMargin=right,
            topMargin=top, bottomMargin=bottom,
            title="License Import Items (Ultra Wide)"
        )

        table = Table(rich_rows, colWidths=widths, repeatRows=1)

        style_cmds = [
            # Header
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.95, 0.95, 0.95)),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),

            # Body
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("VALIGN", (0, 1), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),

            # Grid & box
            ("LINEABOVE", (0, 0), (-1, 0), 0.6, colors.black),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.black),
            ("INNERGRID", (0, 1), (-1, -1), 0.25, colors.Color(0.8, 0.8, 0.8)),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.black),

            # Stripes
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.Color(0.98, 0.98, 0.98)]),

            # Align numbers
            ("ALIGN", (3, 1), (4, -1), "RIGHT"),  # Opening/Balance CIF
            ("ALIGN", (7, 1), (7, -1), "RIGHT"),  # Quantity
            ("ALIGN", (12, 1), (14, -1), "RIGHT"),  # BOE numeric headers
        ]

        # Apply spans for BOE block in each item row
        for c0, r0, c1, r1 in spans:
            style_cmds.append(("SPAN", (c0, r0), (c1, r1)))

        table.setStyle(TableStyle(style_cmds))

        story = [
            Paragraph("License Import Items", styles["TitleBold"]),
            Spacer(1, 6),
            table
        ]

        def _footer(canvas, doc_):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.grey)
            txt = f"Generated: {timezone.localdate().strftime('%d-%b-%Y')}"
            canvas.drawString(doc_.leftMargin, doc_.bottomMargin - 10, txt)
            canvas.drawRightString(doc_.leftMargin + doc_.width, doc_.bottomMargin - 10, f"Page {doc_.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)

        pdf = buffer.getvalue()
        buffer.close()
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = (
            f'inline; filename="LicenseImportItems_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
        )
        return resp
