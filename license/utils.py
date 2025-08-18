# license/utils.py
from django.db.models import Q


def _get_bool(val):
    """
    True/False parser: accepts bool, 'true'/'false', '1'/'0', 'yes'/'no', 'y'/'n'.
    Returns None if empty/invalid.
    """
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in ("true", "1", "yes", "y"):
        return True
    if s in ("false", "0", "no", "n"):
        return False
    return None


def _getlist(params, key):
    """
    Works with QueryDict (request.GET) and plain dicts.
    Returns [] if key missing.
    """
    if hasattr(params, "getlist"):
        return [v for v in params.getlist(key) if str(v).strip() != ""]
    v = params.get(key)
    if v is None or str(v).strip() == "":
        return []
    # support CSV in plain dicts
    return [p for p in str(v).split(",") if p.strip() != ""]


def _get_num(val, cast=float):
    try:
        if val is None or str(val).strip() == "":
            return None
        return cast(val)
    except (TypeError, ValueError):
        return None


def apply_license_filters(qs, params):
    """
    Apply same filters used by LicenseDetailsFilterSet + view conventions.
    This helper DOES NOT enforce the default 'active' behavior;
    call-sites can add that default afterward (as your ViewSet does).

    Supported:
      - status = active|expired|all (convenience, mirrors view)
      - is_expired = true|false (direct override)
      - exporter__in = 1,2,3  OR repeated &exporter__in=1&exporter__in=2
      - port__in     = 5,9    OR repeated
      - from_date (license_date >=)
      - to_date   (license_date <=)
      - license_number (icontains)
      - is_individual = true|false  => import_license__item_details__cif_fc == 0.01 when true
      - is_null = true|false        => TRUE: balance_cif <= 100, FALSE: balance_cif >= 100
      - balance_val + balance_cmp=gte|lte  => balance_cif__{cmp} = balance_val
      - search (matches view search_fields)
    """

    # ---- status / is_expired ----
    status = (params.get("status") or "").strip().lower()
    if status == "active":
        qs = qs.filter(is_expired=False)
    elif status == "expired":
        qs = qs.filter(is_expired=True)
    elif status == "all":
        pass  # no is_expired constraint
    else:
        # If direct is_expired provided, honor it (view treats this as explicit).
        ie = _get_bool(params.get("is_expired"))
        if ie is not None:
            qs = qs.filter(is_expired=ie)

    # ---- exporter__in / port__in ----
    exp_ids = _getlist(params, "exporter__in")
    if exp_ids:
        qs = qs.filter(exporter_id__in=exp_ids)

    port_ids = _getlist(params, "port__in")
    if port_ids:
        qs = qs.filter(port_id__in=port_ids)

    # ---- date range on license_date ----
    if params.get("from_date"):
        qs = qs.filter(license_date__gte=params.get("from_date"))
    if params.get("to_date"):
        qs = qs.filter(license_date__lte=params.get("to_date"))

    # ---- license_number icontains ----
    if params.get("license_number"):
        qs = qs.filter(license_number__icontains=params.get("license_number"))

    # ---- is_individual (FilterSet: import_license__item_details__cif_fc == 0.01 when True)
    ind = _get_bool(params.get("is_individual"))
    if ind is True:
        qs = qs.filter(import_license__item_details__cif_fc=0.01).distinct()

    # ---- is_null legacy rule (TRUE => balance_cif <= 100, FALSE => >= 100)
    is_null = _get_bool(params.get("is_null"))
    if is_null is True:
        qs = qs.filter(balance_cif__lte=100)
    elif is_null is False:
        qs = qs.filter(balance_cif__gte=100)

    # ---- balance_val + balance_cmp
    bal_val = _get_num(params.get("balance_val"), float)
    if bal_val is not None:
        cmp_ = (params.get("balance_cmp") or "gte").lower()
        if cmp_ == "lte":
            qs = qs.filter(balance_cif__lte=bal_val)
        else:
            qs = qs.filter(balance_cif__gte=bal_val)

    # ---- search (mirror your ViewSet.search_fields)
    s = (params.get("search") or "").strip()
    if s:
        qs = qs.filter(
            Q(license_number__icontains=s) |
            Q(file_number__icontains=s) |
            Q(notification_number__icontains=s) |
            Q(scheme_code__icontains=s) |
            Q(exporter__name__icontains=s) |
            Q(port__name__icontains=s)
        )

    return qs
