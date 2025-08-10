# allotment/views.py
from django.db.models import Sum, F, Value, FloatField, Q
from django.db.models.functions import Coalesce
from django.utils.timezone import now
from django_filters import rest_framework as dj_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from allotment.serializers import AllotmentSerializer
from .models import AllotmentModel
from .serializers import AllotmentOptionSerializer


# ---------- Option ViewSet (for selects / lookups) ----------
class AllotmentOptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AllotmentModel.objects.select_related("company", "port")
    serializer_class = AllotmentOptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["invoice", "item_name", "company__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request

        # Default: exclude type='AR' unless caller specifies type/type_in
        type_param = request.query_params.get("type")
        type_in = request.query_params.get("type_in")
        if not type_param and not type_in:
            qs = qs.exclude(type="AR")
        elif type_param:
            qs = qs.filter(type=type_param)
        elif type_in:
            types = [t.strip() for t in type_in.split(",") if t.strip()]
            qs = qs.filter(type__in=types)

        # Optional: exclude allotments already tied to a different BOE (default true)
        boe_id = request.query_params.get("current_boe_id")
        exclude_assigned = request.query_params.get("exclude_assigned", "true").lower() == "true"
        if exclude_assigned:
            if boe_id:
                qs = qs.exclude(~Q(bill_of_entry__id=boe_id) & Q(bill_of_entry__isnull=False))
            else:
                qs = qs.filter(bill_of_entry__isnull=True)

        required_quantity = request.query_params.get("required_quantity")
        if required_quantity:
            qs = qs.filter(required_quantity=required_quantity)

        return qs


# ---------- Filters for main ViewSet ----------
class NumberInFilter(dj_filters.BaseInFilter, dj_filters.NumberFilter):
    """Accepts ?param=1,2,3"""
    pass


class CharInFilter(dj_filters.BaseInFilter, dj_filters.CharFilter):
    """Accepts ?param=a,b,c"""
    pass


class AllotmentFilter(dj_filters.FilterSet):
    # Simple id filters (support CSV lists)
    company = NumberInFilter(field_name="company_id", lookup_expr="in")
    port = NumberInFilter(field_name="port_id", lookup_expr="in")
    related_company = NumberInFilter(field_name="related_company_id", lookup_expr="in")

    # Text filters
    invoice = dj_filters.CharFilter(field_name="invoice", lookup_expr="icontains")
    item_name = dj_filters.CharFilter(field_name="item_name", lookup_expr="icontains")
    type = dj_filters.CharFilter(field_name="type", lookup_expr="exact")  # 'AR' / 'AT'
    type_in = CharInFilter(field_name="type", lookup_expr="in")  # ?type_in=AR,AT

    # Date range (Estimated Arrival Date)
    date_from = dj_filters.DateFilter(field_name="estimated_arrival_date", lookup_expr="gte")
    date_to = dj_filters.DateFilter(field_name="estimated_arrival_date", lookup_expr="lte")

    # Custom flags / joins
    has_balance = dj_filters.BooleanFilter(method="filter_has_balance")  # required_qty > sum(allotted)
    item = NumberInFilter(method="filter_item")  # LicenseImportItemsModel id(s)
    hs_code = dj_filters.CharFilter(method="filter_hs_code")  # accepts code or id-like
    license_number = dj_filters.CharFilter(method="filter_license_number")
    exporter = NumberInFilter(method="filter_exporter")  # exporter company id(s)

    # BOE presence
    has_boe = dj_filters.BooleanFilter(method="filter_has_boe")

    # Ranges on annotations (provided by get_queryset())
    min_balance = dj_filters.NumberFilter(field_name="balanced_qty", lookup_expr="gte")
    max_balance = dj_filters.NumberFilter(field_name="balanced_qty", lookup_expr="lte")
    min_required = dj_filters.NumberFilter(field_name="required_quantity", lookup_expr="gte")
    max_required = dj_filters.NumberFilter(field_name="required_quantity", lookup_expr="lte")

    # Free-text (in addition to DRF SearchFilter)
    q = dj_filters.CharFilter(method="filter_q")

    class Meta:
        model = AllotmentModel
        fields = [
            "company", "port", "related_company", "type", "type_in",
            "invoice", "item_name", "date_from", "date_to",
            "has_balance", "item", "hs_code", "license_number", "exporter",
            "has_boe",
            "min_balance", "max_balance", "min_required", "max_required",
            "q",
        ]

    # --- method filters ---
    def filter_has_balance(self, qs, name, value):
        if value is None:
            return qs
        condition = F("required_quantity") > F("total_allotted_qty")
        return qs.filter(condition) if value else qs.exclude(condition)

    def filter_item(self, qs, name, value):
        if not value:
            return qs
        return qs.filter(allotment_details__item_id__in=value).distinct()

    def filter_hs_code(self, qs, name, value):
        if not value:
            return qs
        v = str(value).strip()
        if v.isdigit():
            return qs.filter(allotment_details__item__hs_code_id=int(v)).distinct()
        return qs.filter(allotment_details__item__hs_code__code__icontains=v).distinct()

    def filter_license_number(self, qs, name, value):
        if not value:
            return qs
        return qs.filter(allotment_details__item__license__license_number__icontains=value).distinct()

    def filter_exporter(self, qs, name, value):
        if not value:
            return qs
        return qs.filter(allotment_details__item__license__exporter_id__in=value).distinct()

    def filter_has_boe(self, qs, name, value):
        if value is None:
            return qs
        return qs.filter(bill_of_entry__isnull=False) if value else qs.filter(bill_of_entry__isnull=True)

    def filter_q(self, qs, name, value):
        if not value:
            return qs
        v = value.strip()
        lookups = (
                Q(item_name__icontains=v)
                | Q(invoice__icontains=v)
                | Q(contact_person__icontains=v)
                | Q(contact_number__icontains=v)
                | Q(bl_detail__icontains=v)
                | Q(company__name__icontains=v)
                | Q(related_company__name__icontains=v)
                | Q(allotment_details__item__description__icontains=v)
                | Q(allotment_details__item__hs_code__code__icontains=v)
                | Q(allotment_details__item__license__license_number__icontains=v)
        )
        return qs.filter(lookups).distinct()


# ---------- Pagination ----------
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


# ---------- Main ViewSet ----------
class AllotmentViewSet(viewsets.ModelViewSet):
    """
    list:     GET /api/allotments/?...filters
    retrieve: GET /api/allotments/{id}/
    create:   POST /api/allotments/
    update:   PUT /api/allotments/{id}/
    partial:  PATCH /api/allotments/{id}/
    delete:   DELETE /api/allotments/{id}/
    """
    serializer_class = AllotmentSerializer
    # permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AllotmentFilter

    search_fields = [
        "item_name",
        "invoice",
        "contact_person",
        "contact_number",
        "bl_detail",
        "company__name",
        "related_company__name",
        "allotment_details__item__description",
        "allotment_details__item__hs_code__code",
        "allotment_details__item__license__license_number",
    ]

    # Allow ordering by computed annotations too
    ordering_fields = [
        "estimated_arrival_date",
        "required_quantity",
        "unit_value_per_unit",
        "item_name",
        "invoice",
        "total_allotted_qty",
        "balanced_qty",
        "total_allotted_value_fc",
        "total_allotted_value_inr",
    ]
    ordering = ["-estimated_arrival_date"]

    def get_queryset(self):
        """
        Annotate totals so we can filter/order on them.
        Also optimize with select_related/prefetch_related.
        """
        qs = (
            AllotmentModel.objects
            .select_related("company", "port", "related_company")
            .prefetch_related(
                "allotment_details",
                "allotment_details__item",
                "allotment_details__item__hs_code",
                "allotment_details__item__license",
                "allotment_details__item__license__exporter",
            )
            .annotate(
                total_allotted_qty=Coalesce(
                    Sum("allotment_details__qty"), Value(0.0), output_field=FloatField()
                ),
                total_allotted_value_fc=Coalesce(
                    Sum("allotment_details__cif_fc"), Value(0.0), output_field=FloatField()
                ),
                total_allotted_value_inr=Coalesce(
                    Sum("allotment_details__cif_inr"), Value(0.0), output_field=FloatField()
                ),
            )
        ).annotate(
            balanced_qty=F("required_quantity") - F("total_allotted_qty")
        )

        return qs.distinct()

    def filter_queryset(self, queryset):
        """
        Apply django-filter, search, ordering; then enforce defaults:
          1) By default, hide allotments that already have a BOE.
          2) By default, hide type='AR' rows.
        Override with ?has_boe=true/false and ?type / ?type_in.
        """
        queryset = super().filter_queryset(queryset)

        # Default: without BOE if not specified
        if "has_boe" not in self.request.query_params:
            queryset = queryset.filter(bill_of_entry__isnull=True)

        # Default: exclude type='AR' if neither 'type' nor 'type_in' specified
        params = self.request.query_params
        if "type" not in params and "type_in" not in params:
            queryset = queryset.exclude(type="AR")

        return queryset

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        agg = qs.aggregate(
            total_required=Sum("required_quantity"),
            total_allotted=Sum("total_allotted_qty"),
            total_balance=Sum("balanced_qty"),
        )
        return Response({
            "as_of": now().date(),
            "count": qs.count(),
            "totals": {
                "required_quantity": float(agg.get("total_required") or 0),
                "allotted_quantity": float(agg.get("total_allotted") or 0),
                "balanced_quantity": float(agg.get("total_balance") or 0),
            },
        })
