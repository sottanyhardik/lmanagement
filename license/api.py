# license/views.py
import datetime
from datetime import date

from dateutil.relativedelta import relativedelta
from django.db.models import Q
from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework import status
from rest_framework import viewsets, permissions, parsers, decorators, response
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from license.utils import apply_license_filters  # <-- import
from .filters import LicenseDetailsFilterSet
from .models import LicenseDetailsModel, GE, MI, SM, OT, CO, RA, LM
from .models import LicenseImportItemsModel
from .models import LicensePurchase
from .serializers import BiscuitReportSerializer
from .serializers import LicenseDetailsSerializer, LicenseImportItemsSelectSerializer
from .serializers import LicensePurchaseSerializer


# ---------------- Pagination ----------------

class SmallPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------- License Details ----------------

# license/views.py (excerpt)
class LicenseDetailsViewSet(viewsets.ModelViewSet):
    """
    Default: show NON-EXPIRED (active) unless the client explicitly asks otherwise.
    ...
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
        qs = super().get_queryset()
        params = self.request.query_params

        # Apply all explicit filters:
        qs = apply_license_filters(qs, params)

        # Enforce default Active-only when neither 'status' nor 'is_expired' provided:
        if 'status' not in params and 'is_expired' not in params:
            qs = qs.filter(is_expired=False)

        return qs


# ---------------- Helpers for select endpoint ----------------

def _get_bool(param_val):
    """
    Accept True/False, "true"/"false", "1"/"0".
    Returns None if param_val is not provided/empty.
    """
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
    """
    Parse numeric query param safely; return None if invalid/empty.
    """
    if param_val is None or str(param_val).strip() == "":
        return None
    try:
        return num_type(param_val)
    except (TypeError, ValueError):
        return None


# ---------------- Import Items: searchable select ----------------

class LicenseImportItemsSelectView(ListAPIView):
    """
    GET /api/license-import-items/select/
      ?q=
      &license_number=
      &sion_norm_id=            (preferred; numeric id)
      &sion_norms=              (fallback; text contains)
      &description=
      &hs_code=
      &notification_number=
      &expired=(true|false)     (window: < +1 month from today)
      &is_expired=(true|false)  (direct field on license)
      &is_null=(true|false)
      &min_balance_cif=<number>
      &min_balance_qty=<number>
      &page=&page_size=
    """
    serializer_class = LicenseImportItemsSelectSerializer
    pagination_class = SmallPagination

    def get_queryset(self):
        p = self.request.query_params
        qs = (
            LicenseImportItemsModel.objects
            .select_related("license", "hs_code")
        )

        today = date.today()
        one_month_from_now = today + relativedelta(months=1)

        # --- Expiry window ---
        expired_window = _get_bool(p.get("expired"))
        if expired_window is True:
            qs = qs.filter(license__license_expiry_date__lt=one_month_from_now)
        elif expired_window is False:
            qs = qs.filter(license__license_expiry_date__gte=one_month_from_now)

        # --- Direct flag override (takes precedence if provided) ---
        is_expired_flag = _get_bool(p.get("is_expired"))
        if is_expired_flag is not None:
            qs = qs.filter(license__is_expired=is_expired_flag)

        # --- Floors ---
        min_balance_cif = _get_num(p.get("min_balance_cif"), float)
        if min_balance_cif is not None:
            qs = qs.filter(available_value__gte=min_balance_cif)

        min_balance_qty = _get_num(p.get("min_balance_qty"), float)
        if min_balance_qty is not None:
            qs = qs.filter(available_quantity__gte=min_balance_qty)

        # --- SION norm ---
        sion_id = (p.get("sion_norm_id") or "").strip()
        if sion_id.isdigit():
            qs = qs.filter(license__export_license__norm_class__id=int(sion_id))
        else:
            sion_txt = (p.get("sion_norms") or "").strip()
            if sion_txt:
                qs = qs.filter(license__export_license__norm_class__norm_class__icontains=sion_txt)

        # --- Free text ---
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

        # --- Specific fields ---
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

        # distinct for joins through export_license
        return qs.distinct().order_by(
            "license__license_expiry_date",
            "license__license_number",
            "serial_number",
        )


class LicenseImportItemsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lightweight endpoint to search by a composed 'display_name' field the FE uses.
    """
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
        date = datetime.datetime.now() - datetime.timedelta(days=30)
        is_expired = status_flag == "expired"

        qs = LicenseDetailsModel.objects.filter(
            export_license__norm_class__norm_class="E5",
            balance_cif__gte=500,
        )

        party_map = {
            "parle": GE,
            "mi": MI,
            "sm": SM,
            "ot": OT,
            "co": CO,
            "ra": RA,
            "lm": LM,
        }
        if is_expired:
            qs = qs.filter(license_expiry_date__lt=date)
        else:
            qs = qs.filter(license_expiry_date__gte=date)

        if party.lower() in party_map:
            qs = qs.filter(purchase_status=party_map[party.lower()])
            if party.lower() == "parle":
                qs = qs.filter(exporter__name__icontains="parle")
        else:
            qs = qs.filter(purchase_status=GE).exclude(exporter__name__icontains="parle")

        serializer = BiscuitReportSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LicensePurchaseViewSet(viewsets.ModelViewSet):
    queryset = LicensePurchase.objects.select_related("license", "supplier", "purchasing_entity")
    serializer_class = LicensePurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        lic = self.request.query_params.get("license")
        if lic:
            qs = qs.filter(license_id=lic)
        return qs

    @decorators.action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        qs = self.get_queryset()
        total = qs.aggregate(s=Sum("amount_inr"))["s"] or 0
        return response.Response({"total_amount_inr": round(total, 2)})
