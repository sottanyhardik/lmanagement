import datetime


def parse_date(date_str):
    """Try DD/MM/YYYY or DD/MM/YY; returns datetime or None."""
    if not isinstance(date_str, str):
        return None
    s = date_str.strip()
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _s(x):
    """Strip strings; pass-through others."""
    return x.strip() if isinstance(x, str) else x


def _strip_row(row):
    """Return a copy of the row with all string cells stripped."""
    return [(_s(c)) for c in row]


def _to_float(x, default=0.0):
    """Float with safety; trims first."""
    if x is None:
        return default
    try:
        return float(_s(x)) if isinstance(x, str) else float(x)
    except (ValueError, TypeError):
        return default


def _to_int(x, default=None):
    """Int with safety; trims first."""
    if x is None:
        return default
    try:
        return int(_s(x)) if isinstance(x, str) else int(x)
    except (ValueError, TypeError):
        return default


def parse_license_data(rows):
    """
    Parses a list of rows (from CSV or OCR extraction) into structured dict_list based on license groupings.
    Each new 'Regn.No.' row marks the beginning of a new license section.

    All string values are stored trimmed (leading/trailing whitespace removed).
    """
    dict_list = []
    current = None

    for raw in rows or []:
        # Normalize/trim every cell first
        row = _strip_row(raw)

        # Skip completely empty rows (all falsy after trimming)
        if not any((c or "") for c in row):
            continue

        # Need at least one cell to inspect; keep original guard
        if len(row) < 2:
            continue

        key0 = (row[0] or "")

        # ---- Start of a new license block ----
        if key0 == "Regn.No.":
            if current:
                dict_list.append(current)

            lic_no = (row[5] if len(row) > 5 else "") or ""
            lic_no = lic_no.strip()
            if len(lic_no) == 9:
                lic_no = "0" + lic_no

            current = {
                "ledger_date": datetime.datetime.now().date(),
                "registration_no": (row[1] if len(row) > 1 else "") or "",
                "registration_date": (row[3] if len(row) > 3 else "") or "",
                "lic_no": lic_no,
                "lic_date": (row[7] if len(row) > 7 else "") or "",
                "row": [],
            }

        # ---- RA No. line (port) ----
        elif key0.replace(' ', '') == "RANo.":
            if current is not None:
                current["port"] = (row[5] if len(row) > 5 else "") or ""

        # ---- IEC line ----
        elif key0 == "IEC":
            if current is not None:
                iec = (row[1] if len(row) > 1 else "") or ""
                iec = iec.strip()
                if len(iec) == 9:
                    iec = "0" + iec

                current["iec"] = iec
                current["scheme_code"] = (row[3] if len(row) > 3 else "") or ""
                current["notification"] = (row[5] if len(row) > 5 else "") or ""
                current["foregin_currency"] = (row[7] if len(row) > 7 else "") or ""

        # ---- Tot. duty line ----
        elif key0.lower() == "tot.duty":
            if current is not None:
                current["cif_inr"] = _to_float(row[3] if len(row) > 3 else 0)
                current["total_quantity"] = _to_float(row[5] if len(row) > 5 else 0)
                current["cif_fc"] = _to_float(row[7] if len(row) > 7 else 0)

        # ---- Credit/Debit rows ----
        elif key0 and key0.lower() in {"credit-", "debit-"} and current is not None:
            is_credit = key0.lower() == "credit-"

            # Common fields
            sr_no = _to_int(row[1] if len(row) > 1 else None)
            cif_inr = _to_float(row[3] if len(row) > 3 else 0)
            cif_fc = _to_float(row[4] if len(row) > 4 else 0)
            qty = _to_float(row[5] if len(row) > 5 else 0)
            be_number = (row[7] if len(row) > 7 else "") or None
            be_date_raw = (row[8] if len(row) > 8 else "") or None
            port = (row[9] if len(row) > 9 else "") or None

            txn = {
                "type": 'C' if is_credit else 'D',
                "sr_no": sr_no,
                "cif_inr": cif_inr,
                "cif_fc": cif_fc,
                "qty": qty,
                "be_number": be_number,
                "be_date": be_date_raw if is_credit else parse_date(be_date_raw),
                "port": port,
            }
            current["row"].append(txn)

    if current:
        dict_list.append(current)

    return dict_list
