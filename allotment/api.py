# allotment/views.py
from decimal import Decimal, ROUND_FLOOR, ROUND_CEILING

from django.db import transaction
from django.db.models import F, Value, FloatField, Q
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils.timezone import now
from django_filters import rest_framework as dj_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from license.models import LicenseImportItemsModel
from .models import AllotmentModel, AllotmentItems
from .serializers import (
    AllotmentSerializer,
    AllotmentOptionSerializer,
    AllotmentItemSerializer,
    AllotmentItemCreateSerializer,
)

INT_STEP = Decimal("1")


def floor_int(x) -> Decimal:
    if x is None:
        return Decimal("0")
    return Decimal(x).to_integral_value(rounding=ROUND_FLOOR)


def ceil_int(x) -> Decimal:
    if x is None:
        return Decimal("0")
    return Decimal(x).to_integral_value(rounding=ROUND_CEILING)


# ---------- Option ViewSet ----------
class AllotmentOptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AllotmentModel.objects.select_related("company", "port")
    serializer_class = AllotmentOptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["invoice", "item_name", "company__name"]

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request

        # Default: exclude type='AR' unless specified
        type_param = request.query_params.get("type")
        type_in = request.query_params.get("type_in")
        if not type_param and not type_in:
            qs = qs.exclude(type="AR")
        elif type_param:
            qs = qs.filter(type=type_param)
        elif type_in:
            types = [t.strip() for t in type_in.split(",") if t.strip()]
            qs = qs.filter(type__in=types)

        # Optionally exclude already assigned to other BOE
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


# ---------- Filters ----------
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

    # Text
    invoice = dj_filters.CharFilter(field_name="invoice", lookup_expr="icontains")
    item_name = dj_filters.CharFilter(field_name="item_name", lookup_expr="icontains")
    type = dj_filters.CharFilter(field_name="type", lookup_expr="exact")
    type_in = CharInFilter(field_name="type", lookup_expr="in")

    # Date range
    date_from = dj_filters.DateFilter(field_name="estimated_arrival_date", lookup_expr="gte")
    date_to = dj_filters.DateFilter(field_name="estimated_arrival_date", lookup_expr="lte")

    # Custom joins/flags
    has_balance = dj_filters.BooleanFilter(method="filter_has_balance")
    item = NumberInFilter(method="filter_item")  # LicenseImportItemsModel id(s)
    hs_code = dj_filters.CharFilter(method="filter_hs_code")
    license_number = dj_filters.CharFilter(method="filter_license_number")
    exporter = NumberInFilter(method="filter_exporter")

    has_boe = dj_filters.BooleanFilter(method="filter_has_boe")

    # Ranges on annotations
    min_balance = dj_filters.NumberFilter(field_name="balanced_qty", lookup_expr="gte")
    max_balance = dj_filters.NumberFilter(field_name="balanced_qty", lookup_expr="lte")
    min_required = dj_filters.NumberFilter(field_name="required_quantity", lookup_expr="gte")
    max_required = dj_filters.NumberFilter(field_name="required_quantity", lookup_expr="lte")

    # Free-text (in addition to DRF SearchFilter)
    q = dj_filters.CharFilter(method="filter_q")

    class Meta:
        model = AllotmentModel
        fields = [
            "company", "port", "type", "type_in",
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

    Extra:
      - GET    /api/allotments/summary/
      - POST   /api/allotments/{id}/transfer-letter/
      - POST   /api/allotments/{id}/details/                 (create one detail)
      - DELETE /api/allotments/{id}/details/{detail_id}/     (delete one detail)
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
            .select_related("company", "port")
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

    # ---- Summary ----
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

    # ---- Stub for TL generation ----
    @action(detail=True, methods=["post"], url_path="transfer-letter")
    def transfer_letter(self, request, pk=None):
        # TODO: implement TL generator
        return Response({"detail": "Generator not implemented"}, status=status.HTTP_501_NOT_IMPLEMENTED)

    # ---- Create a single detail (and update license item balances) ----
    @action(detail=True, methods=["post"], url_path="details")
    @transaction.atomic
    def create_detail(self, request, pk=None):
        allotment = self.get_object()

        ser = AllotmentItemCreateSerializer(
            data=request.data,
            context={"request": request, "allotment": allotment},
        )
        ser.is_valid(raise_exception=True)

        # lock the license item
        lic_item = LicenseImportItemsModel.objects.select_for_update().get(
            pk=ser.validated_data["item"].pk
        )

        unit_price = Decimal(allotment.unit_value_per_unit or 0)

        # incoming (integerised)
        qty_in = floor_int(ser.validated_data.get("qty"))
        cif_in = ceil_int(ser.validated_data.get("cif_fc") or 0)

        # derive missing side
        if cif_in <= 0 and unit_price > 0:
            cif_in = ceil_int(qty_in * unit_price)
        if qty_in <= 0 and unit_price > 0 and cif_in > 0:
            qty_in = floor_int(cif_in / unit_price)

        # current totals on this allotment
        agg = allotment.allotment_details.aggregate(tq=Sum("qty"), tv=Sum("cif_fc"))
        cur_qty = Decimal(agg["tq"] or 0)
        cur_val = Decimal(agg["tv"] or 0)

        # required caps
        req_qty = floor_int(allotment.required_quantity or 0)
        req_val = Decimal(getattr(allotment, "required_cif_fc", 0) or 0)
        if req_val <= 0 and unit_price > 0:
            req_val = ceil_int(req_qty * unit_price)

        rem_qty = max(Decimal("0"), req_qty - cur_qty)
        rem_val = max(Decimal("0"), req_val - cur_val)

        # license caps
        avail_qty = floor_int(lic_item.available_quantity or 0)
        avail_val = floor_int(lic_item.available_value or 0)

        # -------- qty-first (cap ONLY by qty limits), then handle value with clamp --------
        desired_qty = qty_in if qty_in > 0 else min(rem_qty, avail_qty)
        final_qty = max(Decimal("0"), min(desired_qty, rem_qty, avail_qty))

        if final_qty <= 0:
            return Response({"detail": "No quantity can be allotted."}, status=status.HTTP_400_BAD_REQUEST)

        # value limit available to spend on this line
        lim_val = min(rem_val, avail_val)

        if unit_price > 0:
            needed_cif = ceil_int(final_qty * unit_price)  # preferred (round up)
            min_ok_cif = floor_int(final_qty * unit_price)  # minimum integer to keep qty

            if needed_cif <= lim_val:
                final_cif = needed_cif
            elif lim_val >= min_ok_cif:
                # clamp to remaining value but keep the quantity
                final_cif = lim_val
            else:
                # even floor(q*price) doesn't fit -> reduce quantity to fit lim_val
                q_fit_by_val = floor_int(lim_val / unit_price)
                final_qty = max(Decimal("0"), min(final_qty, q_fit_by_val, rem_qty, avail_qty))
                if final_qty <= 0:
                    return Response({"detail": "Insufficient remaining value to allot any quantity."},
                                    status=status.HTTP_400_BAD_REQUEST)
                final_cif = min(ceil_int(final_qty * unit_price), rem_val, avail_val)
        else:
            # no unit price -> take incoming cif within value caps
            if cif_in <= 0:
                return Response({"detail": "CIF $ required when unit price is not set."},
                                status=status.HTTP_400_BAD_REQUEST)
            final_cif = min(cif_in, rem_val, avail_val)
            if final_cif <= 0:
                return Response({"detail": "No value available to allot."}, status=status.HTTP_400_BAD_REQUEST)

        # guards
        if final_qty <= 0 or final_cif <= 0:
            return Response({"detail": "Allotment after constraints is zero."},
                            status=status.HTTP_400_BAD_REQUEST)

        # create detail with final values
        obj = ser.save(qty=final_qty, cif_fc=final_cif)

        # update license running balances
        lic_item.available_quantity = (Decimal(lic_item.available_quantity or 0) - final_qty)
        if lic_item.available_quantity < 0:
            lic_item.available_quantity = Decimal("0")

        lic_item.available_value = (Decimal(lic_item.available_value or 0) - final_cif)
        if lic_item.available_value < 0:
            lic_item.available_value = Decimal("0")

        lic_item.allotted_quantity = (Decimal(lic_item.allotted_quantity or 0) + final_qty)
        lic_item.allotted_value = (Decimal(lic_item.allotted_value or 0) + final_cif)

        lic_item.save(update_fields=[
            "available_quantity", "available_value",
            "allotted_quantity", "allotted_value",
        ])

        return Response(AllotmentItemSerializer(obj).data, status=status.HTTP_201_CREATED)

    # ---- Delete a single detail (and reverse license item balances) ----
    # inside AllotmentViewSet

    @action(detail=True, methods=["delete"], url_path=r"details/(?P<detail_id>\d+)")
    @transaction.atomic
    def delete_detail(self, request, pk=None, detail_id=None):
        allotment = self.get_object()
        try:
            # Lock only the detail row; DO NOT use select_related here.
            detail = (
                AllotmentItems.objects
                .select_for_update()
                .only("id", "item_id", "qty", "cif_fc")
                .get(pk=detail_id, allotment_id=allotment.id)
            )
        except AllotmentItems.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Lock the license item in a separate statement
        lic_item = (
            LicenseImportItemsModel.objects
            .select_for_update()
            .only("id", "available_quantity", "available_value", "allotted_quantity", "allotted_value")
            .get(pk=detail.item_id)
        )

        from decimal import Decimal
        qty = Decimal(detail.qty or 0)
        cif_fc = Decimal(detail.cif_fc or 0)

        # Reverse running totals (never below zero)
        lic_item.allotted_quantity = (Decimal(lic_item.allotted_quantity or 0) - qty)
        if lic_item.allotted_quantity < 0:
            lic_item.allotted_quantity = Decimal("0")

        lic_item.allotted_value = (Decimal(lic_item.allotted_value or 0) - cif_fc)
        if lic_item.allotted_value < 0:
            lic_item.allotted_value = Decimal("0")

        lic_item.available_quantity = (Decimal(lic_item.available_quantity or 0) + qty)
        lic_item.available_value = (Decimal(lic_item.available_value or 0) + cif_fc)

        lic_item.save(update_fields=[
            "allotted_quantity", "allotted_value", "available_quantity", "available_value"
        ])

        detail.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
