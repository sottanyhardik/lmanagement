from django.db import models as dj_models
from django_filters import rest_framework as filters

from ..models import LicenseTrade, LicenseTradePayment


class LicenseTradeFilter(filters.FilterSet):
    # core fields
    direction = filters.CharFilter(field_name="direction")
    boe = filters.NumberFilter(field_name="boe_id")

    # company filters
    company = filters.NumberFilter(method="filter_company_any_side")
    from_company = filters.NumberFilter(field_name="from_company_id")
    to_company = filters.NumberFilter(field_name="to_company_id")

    # date & totals ranges
    date_from = filters.DateFilter(field_name="invoice_date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="invoice_date", lookup_expr="lte")
    min_total = filters.NumberFilter(field_name="total_amount", lookup_expr="gte")
    max_total = filters.NumberFilter(field_name="total_amount", lookup_expr="lte")

    # text search helpers
    invoice_number = filters.CharFilter(field_name="invoice_number", lookup_expr="icontains")
    remarks = filters.CharFilter(field_name="remarks", lookup_expr="icontains")

    # business helper
    has_due = filters.BooleanFilter(method="filter_has_due")

    class Meta:
        model = LicenseTrade
        fields = [
            "direction",
            "boe",
            "company",
            "from_company",
            "to_company",
            "date_from",
            "date_to",
            "min_total",
            "max_total",
            "invoice_number",
            "remarks",
            "has_due",
        ]

    def filter_company_any_side(self, qs, name, value):
        return qs.filter(
            dj_models.Q(from_company_id=value) | dj_models.Q(to_company_id=value)
        )

    def filter_has_due(self, qs, name, value):
        # relies on annotated due_amount in get_queryset()
        if value is True:
            return qs.filter(due_amount__gt=0)
        if value is False:
            return qs.filter(due_amount__lte=0)
        return qs


class LicenseTradePaymentFilter(filters.FilterSet):
    trade = filters.NumberFilter(field_name="trade_id")
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")
    min_amount = filters.NumberFilter(field_name="amount", lookup_expr="gte")
    max_amount = filters.NumberFilter(field_name="amount", lookup_expr="lte")

    class Meta:
        model = LicenseTradePayment
        fields = ["trade", "date_from", "date_to", "min_amount", "max_amount"]
