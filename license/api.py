# license/api.py
import datetime
from datetime import date

from dateutil.relativedelta import relativedelta
from django.db.models import Q, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets, permissions, parsers, decorators, response
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import LicenseDetailsFilterSet
from .models import (
    LicenseDetailsModel,
    LicenseImportItemsModel,
    LicensePurchase,  # <-- ensure this import exists
    GE, MI, SM, OT, CO, RA, LM,
)
from .serializers import (
    LicenseDetailsSerializer,
    LicenseImportItemsSelectSerializer,
    BiscuitReportSerializer,
    LicensePurchaseSerializer,  # <-- and this
)


# ---------- helpers ----------
def _get_bool(param_val):
    if param_val is None:
        return None
    if isinstance(param_val, bool):
        return param_val
    s = str(param_val).strip().lower()
    if s in ("true", "1", "yes", "y"):
        return True
    if s in ("false", "0", "no", "n"):
        return False
    return None


def _get_num(param_val, num_type=float):
    if param_val is None or str(param_val).strip() == "":
        return None
    try:
        return num_type(param_val)
    except (TypeError, ValueError):
        return None


# ---------------- Pagination ----------------
class SmallPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------- License Details ----------------
class LicenseDetailsViewSet(viewsets.ModelViewSet):
    """
    Default: show NON-EXPIRED (active) unless the client explicitly asks otherwise.
    """
    queryset = (
        LicenseDetailsModel.objects
        .select_related('exporter', 'port')
        .prefetch_related('export_license', 'import_license')
        .all()
        .distinct()
    )
    serializer_class = LicenseDetailsSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = LicenseDetailsFilterSet

    search_fields = [
        'license_number', 'file_number', 'notification_number', 'scheme_code',
        'exporter__name', 'port__name',
    ]
    ordering_fields = ['license_date', 'license_expiry_date', 'modified_on']
    ordering = ['-modified_on']

    def get_queryset(self):
        # If you have a shared helper like `apply_license_filters`, call it here
        qs = super().get_queryset()
        params = self.request.query_params

        # --- Balance (CIF) comparator filter ---
        # Accepts: balance_val (number), balance_cmp ('gte'|'lte'), default 'gte'
        balance_val = _get_num(params.get("balance_val"), float)
        if balance_val is not None:
            cmp_key = (params.get("balance_cmp") or "gte").strip().lower()
            if cmp_key == "lte":
                qs = qs.filter(balance_cif__lte=balance_val)
            else:
                qs = qs.filter(balance_cif__gte=balance_val)

        # Basic date & text filters commonly used (keep if you don’t already do this in a helper)
        from_date = (params.get("from_date") or "").strip()
        to_date = (params.get("to_date") or "").strip()
        if from_date:
            qs = qs.filter(license_date__gte=from_date)
        if to_date:
            qs = qs.filter(license_date__lte=to_date)

        lic_no = (params.get("license_number") or "").strip()
        if lic_no:
            qs = qs.filter(license_number__icontains=lic_no)

        exporter_in = (params.get("exporter__in") or "").strip()
        if exporter_in:
            ids = [int(x) for x in exporter_in.split(",") if x.isdigit()]
            if ids:
                qs = qs.filter(exporter_id__in=ids)

        port_in = (params.get("port__in") or "").strip()
        if port_in:
            ids = [int(x) for x in port_in.split(",") if x.isdigit()]
            if ids:
                qs = qs.filter(port_id__in=ids)

        # Default Active-only when not explicitly overridden
        if 'status' not in params and 'is_expired' not in params:
            qs = qs.filter(is_expired=False)

        return qs


# ---------------- Import Items: searchable select ----------------
class LicenseImportItemsSelectView(ListAPIView):
    serializer_class = LicenseImportItemsSelectSerializer
    pagination_class = SmallPagination

    def get_queryset(self):
        p = self.request.query_params
        qs = LicenseImportItemsModel.objects.select_related("license", "hs_code")

        today = date.today()
        one_month_from_now = today + relativedelta(months=1)

        expired_window = _get_bool(p.get("expired"))
        if expired_window is True:
            qs = qs.filter(license__license_expiry_date__lt=one_month_from_now)
        elif expired_window is False:
            qs = qs.filter(license__license_expiry_date__gte=one_month_from_now)

        is_expired_flag = _get_bool(p.get("is_expired"))
        if is_expired_flag is not None:
            qs = qs.filter(license__is_expired=is_expired_flag)

        min_balance_cif = _get_num(p.get("min_balance_cif"), float)
        if min_balance_cif is not None:
            qs = qs.filter(available_value__gte=min_balance_cif)

        min_balance_qty = _get_num(p.get("min_balance_qty"), float)
        if min_balance_qty is not None:
            qs = qs.filter(available_quantity__gte=min_balance_qty)

        sion_id = (p.get("sion_norm_id") or "").strip()
        if sion_id.isdigit():
            qs = qs.filter(license__export_license__norm_class__id=int(sion_id))
        else:
            sion_txt = (p.get("sion_norms") or "").strip()
            if sion_txt:
                qs = qs.filter(license__export_license__norm_class__norm_class__icontains=sion_txt)

        q = (p.get("q") or "").strip()
        if q:
            q_filter = (
                    Q(license__license_number__icontains=q) |
                    Q(description__icontains=q) |
                    Q(hs_code__hs_code__icontains=q)
            )
            if q.isdigit():
                q_filter |= Q(serial_number=int(q))
            qs = qs.filter(q_filter)

        lic_no = (p.get("license_number") or "").strip()
        if lic_no:
            qs = qs.filter(license__license_number__icontains=lic_no)

        desc = (p.get("description") or "").strip()
        if desc:
            qs = qs.filter(description__icontains=desc)

        hs = (p.get("hs_code") or "").strip()
        if hs:
            qs = qs.filter(hs_code__hs_code__icontains=hs)

        notif = (p.get("notification_number") or "").strip()
        if notif:
            qs = qs.filter(license__notification_number__icontains=notif)

        is_null_flag = _get_bool(p.get("is_null"))
        if is_null_flag is not None:
            qs = qs.filter(license__is_null=is_null_flag)

        return qs.distinct().order_by(
            "license__license_expiry_date",
            "license__license_number",
            "serial_number",
        )


class LicenseImportItemsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        LicenseImportItemsModel.objects
        .select_related('license')
        .all()
        .order_by('-license__license_expiry_date')
        .distinct()
    )
    serializer_class = LicenseImportItemsSelectSerializer
    filter_backends = [filters.SearchFilter]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('display_name')

        if search and ' - ' in search:
            license_part, sr_part = search.split(' - ', 1)
            queryset = queryset.filter(
                license__license_number__icontains=license_part.strip(),
                serial_number__icontains=sr_part.strip()
            )
        elif search:
            queryset = queryset.filter(
                Q(license__license_number__istartswith=search) |
                Q(license__license_number__iendswith=search)
            )

        return queryset.distinct()


class BiscuitReportAPIView(APIView):
    def get(self, request, party, status_flag):
        since = datetime.datetime.now() - datetime.timedelta(days=30)
        is_expired = status_flag == "expired"

        qs = LicenseDetailsModel.objects.filter(
            export_license__norm_class__norm_class="E5",
            balance_cif__gte=500,
        )

        party_map = {
            "parle": GE, "mi": MI, "sm": SM, "ot": OT,
            "co": CO, "ra": RA, "lm": LM,
        }
        if is_expired:
            qs = qs.filter(license_expiry_date__lt=since)
        else:
            qs = qs.filter(license_expiry_date__gte=since)

        if party.lower() in party_map:
            qs = qs.filter(purchase_status=party_map[party.lower()])
            if party.lower() == "parle":
                qs = qs.filter(exporter__name__icontains="parle")
        else:
            qs = qs.filter(purchase_status=GE).exclude(exporter__name__icontains="parle")

        serializer = BiscuitReportSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------- License Purchases ----------------
class LicensePurchaseViewSet(viewsets.ModelViewSet):
    """
    CRUD for license purchases/payments with a quick summary endpoint.

    Query params supported:
      - license=<id>         filter by license FK
      - from_date=YYYY-MM-DD purchase_date >= from_date
      - to_date=YYYY-MM-DD   purchase_date <= to_date
      - min_amount=<float>   amount_inr >= min_amount
      - max_amount=<float>   amount_inr <= max_amount
      - search=<text>        applies to reference/remarks and license number
    """
    queryset = LicensePurchase.objects.select_related("license").all()
    serializer_class = LicensePurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = SmallPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["reference", "remarks", "license__license_number"]
    ordering_fields = ["purchase_date", "amount_inr", "created_at", "modified_at"]
    ordering = ["-purchase_date"]

    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params

        lic = (p.get("license") or "").strip()
        if lic.isdigit():
            qs = qs.filter(license_id=int(lic))

        from_date = (p.get("from_date") or "").strip()
        to_date = (p.get("to_date") or "").strip()
        if from_date:
            qs = qs.filter(purchase_date__gte=from_date)
        if to_date:
            qs = qs.filter(purchase_date__lte=to_date)

        min_amount = _get_num(p.get("min_amount"), float)
        if min_amount is not None:
            qs = qs.filter(amount_inr__gte=min_amount)

        max_amount = _get_num(p.get("max_amount"), float)
        if max_amount is not None:
            qs = qs.filter(amount_inr__lte=max_amount)

        # free-text search is handled by SearchFilter, but allow ?search= as well
        search = (p.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(reference__icontains=search) |
                Q(remarks__icontains=search) |
                Q(license__license_number__icontains=search)
            )

        return qs

    @decorators.action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        qs = self.get_queryset()
        total = qs.aggregate(s=Sum("amount_inr"))["s"] or 0
        return response.Response({"total_amount_inr": round(total, 2)})
