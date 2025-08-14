import django_filters

from .models import LicenseDetailsModel


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """
    Accepts: ?exporter__in=1,2,3  (comma-separated) or repeated params (?exporter__in=1&exporter__in=2).
    """
    pass


import django_filters
from django.db import models
from django.utils import timezone

from . import models as lic_model


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    """Accepts comma-separated or repeated ?param=1&param=2 IDs."""
    pass


class LicenseDetailsFilterSet(django_filters.FilterSet):
    """
    API filterset with custom booleans and numeric balance filters:

      - is_expired: True -> expiry < today, False -> expiry >= today
      - is_individual: True -> import_license__item_details__cif_fc == 0.01
      - is_null: TRUE => balance_cif <= 100, FALSE => balance_cif >= 100 (legacy)

      - balance_cif__gte: numeric lower bound
      - balance_cif__lte: numeric upper bound
    """

    is_individual = django_filters.BooleanFilter(method="filter_is_individual", label="Is Individual")
    is_expired = django_filters.BooleanFilter(method="filter_is_expired", label="Is Expired")
    is_null = django_filters.BooleanFilter(method="filter_is_null", label="Is Null")

    # NEW: numeric thresholds
    balance_cif__gte = django_filters.NumberFilter(field_name="balance_cif", lookup_expr="gte")
    balance_cif__lte = django_filters.NumberFilter(field_name="balance_cif", lookup_expr="lte")

    class Meta:
        model = lic_model.LicenseDetailsModel
        fields = [
            "license_number",
            "import_license__description",
            "exporter",
            "is_au",
            "is_incomplete",
            "is_expired",
            "is_active",
            "is_not_registered",
            "balance_cif__gte",  # numeric
            "balance_cif__lte",  # numeric
        ]
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

    def filter_is_expired(self, queryset, name, value: bool):
        today = timezone.now().date()
        if value is True:
            return queryset.filter(license_expiry_date__lt=today).order_by("-license_expiry_date")
        if value is False:
            return queryset.filter(license_expiry_date__gte=today).order_by("-license_expiry_date")
        return queryset

    def filter_is_individual(self, queryset, name, value: bool):
        if value is True:
            return queryset.filter(import_license__item_details__cif_fc=0.01).distinct()
        return queryset

    def filter_is_null(self, queryset, name, value: bool):
        # Legacy toggle for a fixed 100 threshold; prefer numeric filters above
        if value is True:
            return queryset.filter(balance_cif__lte=100).distinct()
        if value is False:
            return queryset.filter(balance_cif__gte=100).distinct()
        return queryset


class LicenseReportFilter(django_filters.FilterSet):
    is_expired = django_filters.BooleanFilter(method="check_expired", label="Is Expired")
    is_conversion = django_filters.BooleanFilter(method="check_conversion", label="Is Conversion")
    is_individual = django_filters.BooleanFilter(method="check_individual", label="Is Individual")

    class Meta:
        model = LicenseDetailsModel
        fields = ["license_number", "exporter", "is_conversion", "notification_number"]
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

    def check_expired(self, queryset, name, value: bool):
        today = timezone.now().date()
        return (
            queryset.filter(license_expiry_date__lt=today)
            if value
            else queryset.filter(license_expiry_date__gte=today)
        )

    def check_individual(self, queryset, name, value: bool):
        return (
            queryset.filter(import_license__item_details__cif_fc=0.01).distinct()
            if value
            else queryset
        )

    def check_conversion(self, queryset, name, value: bool):
        """
        If value is True -> include rows where export_license.old_quantity != 0
        Else -> rows where old_quantity == 0
        """
        return (
            queryset.exclude(export_license__old_quantity=0).distinct()
            if value
            else queryset.filter(export_license__old_quantity=0).distinct()
        )
