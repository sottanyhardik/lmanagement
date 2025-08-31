# filters.py — clean, standardized
import datetime

import django_filters
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.forms import Select
from django.utils.timezone import now
from django_filters import DateFromToRangeFilter

from allotment import models as allotment_model
from core.filter_helper import RangeWidget
from license import models as license_model


# ---------- Generic helpers ----------
class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Accepts comma-separated list of strings."""
    pass


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """Accepts comma-separated list of numbers."""
    pass


# ---------- License Import Items search (used by Allotment allot UI) ----------
class AllotmentItemFilter(django_filters.FilterSet):
    """
    Filters LicenseImportItemsModel in the "pick items to allot" flow.
    - remove_expired: items whose license expiry is older than EXPIRY_DAY days
    - remove_null: keep rows with sufficient balances (optimized DB-side)
    """

    remove_expired = django_filters.BooleanFilter(
        method="filter_expired",
        label="Is Expired",
    )
    remove_null = django_filters.BooleanFilter(
        method="filter_remove_null",
        label="Remove Null",
    )

    class Meta:
        model = license_model.LicenseImportItemsModel
        fields = [
            "license__license_number",
            "license__notification_number",
            "license__export_license__norm_class",
            "hs_code__hs_code",
            "description",
        ]
        widgets = {
            "license__notification_number": Select(attrs={"class": "form-control"}),
        }
        filter_overrides = {
            models.CharField: {
                "filter_class": django_filters.CharFilter,
                "extra": lambda f: {"lookup_expr": "icontains"},
            },
            models.TextField: {
                "filter_class": django_filters.CharFilter,
                "extra": lambda f: {"lookup_expr": "icontains"},
            },
        }

    def filter_remove_null(self, queryset, name, value: bool):
        """
        Original logic (Python-iterating) replaced by DB-side filter:

        Keep rows where:
          balance_quantity > 100 AND (balance_cif_fc > 100 OR balance_cif_fc == 0.01)
        """
        if not value:
            return queryset
        return queryset.filter(
            Q(balance_quantity__gt=100)
            & (Q(balance_cif_fc__gt=100) | Q(balance_cif_fc=0.01))
        )

    def filter_expired(self, queryset, name, value: bool):
        """
        Filter by license_expiry_date against settings.EXPIRY_DAY (default 30).
        If value==True: return expired items (older than limit).
        If value==False: return non-expired items (newer than or equal to limit).
        """
        expiry_days = getattr(settings, "EXPIRY_DAY", 30)
        expiry_limit = now() - datetime.timedelta(days=expiry_days)
        if value:
            return queryset.filter(license__license_expiry_date__lt=expiry_limit).order_by(
                "license__license_expiry_date"
            )
        return queryset.filter(license__license_expiry_date__gte=expiry_limit)


# ---------- Allotments list filters (DRF list endpoint) ----------
class AllotmentFilter(django_filters.FilterSet):
    """
    Filters for AllotmentModel list endpoint.

    Includes both "include" and "exclude" multi-selects for company and port,
    plus convenience filters frequently used in the UI.
    """

    # License numbers present under nested details (CSV of strings)
    license_numbers = CharInFilter(
        field_name="allotment_details__item__license__license_number",
        label="License Numbers",
    )

    # Company include/exclude (by ID)
    company = NumberInFilter(
        field_name="company_id",
        lookup_expr="in",
        label="Company (IDs)",
    )
    exclude_company = NumberInFilter(
        field_name="company_id",
        lookup_expr="in",
        exclude=True,
        label="Exclude Company (IDs)",
    )

    # Port include/exclude (by ID)
    port = NumberInFilter(
        field_name="port_id",
        lookup_expr="in",
        label="Port (IDs)",
    )
    exclude_port = NumberInFilter(
        field_name="port_id",
        lookup_expr="in",
        exclude=True,
        label="Exclude Port (IDs)",
    )

    # Optional: filter by port code list (CSV strings) – handy for quick queries
    port_code = CharInFilter(
        field_name="port__code",
        label="Port Codes",
    )

    # Back-compat flags (kept with clearer behavior)
    is_be = django_filters.BooleanFilter(
        method="filter_has_boe",
        label="Has BOE",
        initial=False,
    )
    is_alloted = django_filters.BooleanFilter(
        method="filter_has_allotted",
        label="Has Allotted License",
        initial=True,
    )

    # Date range on modified_on (uses your RangeWidget)
    modified_on = DateFromToRangeFilter(
        widget=RangeWidget(
            attrs={"placeholder": "DD/MM/YYYY", "format": "dd/mm/yyyy", "type": "date"}
        )
    )

    class Meta:
        model = allotment_model.AllotmentModel
        fields = [
            # Free-text-ish
            "type",
            "item_name",
            # Multi-selects
            "company",
            "exclude_company",
            "port",
            "exclude_port",
            # Other helpers
            "license_numbers",
            "port_code",
            # Flags & range
            "is_be",
            "is_alloted",
            "modified_on",
        ]
        widgets = {
            "company": Select(attrs={"class": "form-control"}),
            "type": Select(attrs={"class": "form-control"}),
        }
        filter_overrides = {
            models.CharField: {
                "filter_class": django_filters.CharFilter,
                "extra": lambda f: {"lookup_expr": "icontains"},
            },
            models.TextField: {
                "filter_class": django_filters.CharFilter,
                "extra": lambda f: {"lookup_expr": "icontains"},
            },
        }

    # Preserve prior behavior: auto-apply `initial` values when params omitted
    def __init__(self, data=None, *args, **kwargs):
        if data is not None:
            data = data.copy()
            for name, f in self.base_filters.items():
                initial = f.extra.get("initial")
                if not data.get(name) and initial is not None:
                    data[name] = initial
        super().__init__(data, *args, **kwargs)

    # ---- Custom filter methods ----
    def filter_has_boe(self, queryset, name, value: bool):
        """
        If value is True: keep rows with a related BOE
        If value is False: keep rows without related BOE
        """
        # bill_of_entry is assumed to be a FK/related name from Allotment to BOE
        return queryset.exclude(bill_of_entry__isnull=value).distinct()

    def filter_has_allotted(self, queryset, name, value: bool):
        """
        If value is True: keep rows with any allotted license number present
        If value is False: keep rows where that license number is null
        """
        return queryset.exclude(
            allotment_details__item__license__license_number__isnull=value
        ).distinct()
