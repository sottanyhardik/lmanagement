# trade/views_invoice.py
from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from easy_pdf.views import PDFTemplateView

from trade.models import LicenseTrade, q2


# --- Amount in words (Rupees) ---
def _amount_to_words_rupees(n: Decimal) -> str:
    ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
            "Nineteen"]
    tens = ["", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def two_digits(num):
        if num < 20:
            return ones[num]
        return (tens[num // 10] + (" " + ones[num % 10] if num % 10 else "")).strip()

    def three_digits(num):
        h, rem = divmod(num, 100)
        prefix = (ones[h] + " Hundred ") if h else ""
        if rem == 0:
            return prefix.strip() or "Zero"
        if rem < 20:
            return (prefix + ones[rem]).strip()
        return (prefix + two_digits(rem)).strip()

    def int_to_indian_words(num):
        if num == 0:
            return "Zero"
        parts = []
        crore, num = divmod(num, 10_000_000)
        if crore:
            parts.append(three_digits(crore) + " Crore")
        lakh, num = divmod(num, 100_000)
        if lakh:
            parts.append(three_digits(lakh) + " Lakh")
        thousand, num = divmod(num, 1000)
        if thousand:
            parts.append(three_digits(thousand) + " Thousand")
        if num:
            parts.append(three_digits(num))
        return " ".join(parts)

    n = q2(n or 0)
    rupees = int(n)
    paise = int((n - Decimal(rupees)) * 100)
    words = f"Rupees {int_to_indian_words(rupees)}"
    if paise:
        words += f" and {two_digits(paise)} Paise"
    return words + " Only"


class LicenseTradeInvoicePDFView(PDFTemplateView):
    """
    Renders your provided HTML template using LicenseTrade data.

    URL (matches your serializer's sale_pdf_url):
      /api/trades/<pk>/invoice-pdf/
    """
    # 👉 keep the SAME template file you pasted
    template_name = "trade/invoice_template.html"

    def _get_trade(self):
        return get_object_or_404(
            LicenseTrade.objects.select_related("from_company", "to_company", "boe")
            .prefetch_related("lines", "payments"),
            pk=self.kwargs["pk"],
        )

    def get_context_data(self, **kwargs):
        trade = self._get_trade()

        # Keep snapshots & totals up-to-date
        trade.snapshot_parties()
        trade.recompute_totals()

        # Auto-generate invoice number for SALE if blank (same rule as your serializer)
        if trade.direction == LicenseTrade.DIR_SALE and not (trade.invoice_number or "").strip():
            seller = trade.from_company or trade.to_company
            if seller:
                trade.invoice_number = LicenseTrade.next_invoice_number(
                    seller_company=seller, invoice_date=trade.invoice_date
                )
                trade.save(update_fields=["invoice_number", "modified_on"])

        # ---------- Map to template fields ----------
        # "entity" → issuing party (seller side). Your template uses:
        #   entity.logo.url, entity.name, address_line_1/2, pan_number, gst_number,
        #   signature.url, stamp.url, bill_colour, email
        co = trade.from_company or trade.to_company  # prefer from_company as issuer
        entity = {
            "logo": getattr(co, "logo", None),
            "name": getattr(co, "name", "") or "",
            "address_line_1": getattr(co, "address_line_1", "") or "",
            "address_line_2": getattr(co, "address_line_2", "") or "",
            # Your template expects 'pan_number' and 'gst_number' names:
            "pan_number": (trade.from_pan or getattr(co, "pan", "") or ""),
            "gst_number": (trade.from_gst or getattr(co, "gst_number", "") or ""),
            "signature": getattr(co, "signature", None),
            "stamp": getattr(co, "stamp", None),
            "bill_colour": getattr(co, "bill_colour", "#333"),
            "email": getattr(co, "email", "") or "",
        }

        # "to_company" fields used by template:
        to = {
            "name": getattr(trade.to_company, "name", "") or "",
            "address_line_1": trade.to_addr_line_1 or getattr(trade.to_company, "address_line_1", "") or "",
            "address_line_2": trade.to_addr_line_2 or getattr(trade.to_company, "address_line_2", "") or "",
            "pan": (trade.to_pan or getattr(trade.to_company, "pan", "") or ""),
            "gst_number": (trade.to_gst or getattr(trade.to_company, "gst_number", "") or ""),
        }

        # Determine billing mode per your table switch:
        # If ALL lines are QTY, show KG mode; otherwise show CIF mode.
        lines_qs = trade.lines.all()
        all_qty = lines_qs.exists() and all(ln.mode == ln.MODE_QTY for ln in lines_qs)
        billing_mode = "kg" if all_qty else "amount"  # any non-kg mode will use CIF/Rate(%)

        # Build items the way your template expects
        # Keys: licenseNo, hsnCode, qty (for kg), cifUsd, exchangeRate, cifInr, rate, amount
        items = []
        total_qty = Decimal("0")
        total_cif_fc = Decimal("0")
        total_cif_inr = Decimal("0")

        for ln in lines_qs.select_related("sr_number", "sr_number__license"):
            sr = ln.sr_number
            lic = getattr(sr, "license", None)
            license_no = (getattr(lic, "license_number", "") or "").replace("LIC ", "").split("• SR")[0]
            hsn_code = getattr(sr, "hsn_code", "") or "49070000"

            if all_qty:
                qty = q2(ln.qty_kg)
                rate = q2(ln.rate_inr_per_kg)
                items.append({
                    "licenseNo": str(license_no).zfill(10),
                    "hsnCode": hsn_code,
                    "qty": f"{qty}",  # used only when billing_mode == 'kg'
                    "rate": f"{rate}",
                    "amount": f"{q2(ln.amount_inr)}",
                })
                total_qty += qty
            else:
                cif_fc = q2(ln.cif_fc)
                exc = q2(ln.exc_rate)
                cif_inr = q2(ln.cif_inr)
                pct = q2(ln.pct)  # percent used as "Rate (%)" column
                items.append({
                    "licenseNo": str(license_no).zfill(10),
                    "hsnCode": hsn_code,
                    "cifUsd": f"{cif_fc}",
                    "exchangeRate": f"{exc}",
                    "cifInr": f"{cif_inr}",
                    "rate": f"{pct}",
                    "amount": f"{q2(ln.amount_inr)}",
                })
                total_cif_fc += cif_fc
                total_cif_inr += cif_inr

        # "invoice" block that your template reads
        invoice = {
            "invoice_number": trade.invoice_number or "",
            "invoice_date": trade.invoice_date,  # template prints directly
            "billing_mode": billing_mode,  # 'kg' or anything else
            "total_qty": q2(total_qty),
            "total_cif_fc": q2(total_cif_fc),
            "total_cif_inr": q2(total_cif_inr),
            "total_amount": q2(trade.total_amount),
            # For "Remark" section
            "bills_of_entry": trade.boe,  # accessed as invoice.bills_of_entry.*
        }

        # "bank" block your template expects on the right
        bank = {
            "accountNo": getattr(co, "bank_account_number", "") or "",
            "bankName": getattr(co, "bank_name", "") or "",
            "ifsc": getattr(co, "ifsc_code", "") or "",
            "accountType": getattr(co, "get_account_type_display", lambda: "")() or "",
        }

        context = {
            "entity": entity,
            "invoice": invoice,
            "to_company": to,
            "items": items,
            "bank": bank,
            "amount_in_words": _amount_to_words_rupees(trade.total_amount),
        }
        return super().get_context_data(pagesize="A4", **context)

    def get_download_filename(self):
        trade = self._get_trade()
        inv = (trade.invoice_number or f"TRADE-{trade.pk}").strip()
        return f"{slugify(inv).upper() or f'TRADE-{trade.pk}'}.pdf"
