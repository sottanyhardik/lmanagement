# license/views.py
from datetime import date

from dateutil.relativedelta import relativedelta
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination

from license.models import LicenseDetailsModel
from license.serializers import LicenseDetailsSerializer
from .models import LicenseImportItemsModel
from .serializers import LicenseImportItemsSelectSerializer


class SmallPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class LicenseDetailsViewSet(viewsets.ModelViewSet):
    queryset = (
        LicenseDetailsModel.objects
        .all()
        .prefetch_related('export_license', 'import_license')
        .distinct()
    )
    serializer_class = LicenseDetailsSerializer

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    filterset_fields = [
        'scheme_code',
        'notification_number',
        'license_number',
        'license_date',
        'license_expiry_date',
        'exporter',
        'port',
        'purchase_status',
        'is_active',
        'is_expired',
        'is_incomplete',
    ]

    search_fields = [
        'license_number',
        'file_number',
        'notification_number',
        'scheme_code',
        'exporter__name',
        'port__name',
    ]

    ordering_fields = ['license_date', 'license_expiry_date', 'modified_on']
    ordering = ['-modified_on']


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
      &expired=(true|false)     (uses 1-month window relative to today)
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

        # --- Expiry filters ---
        # 1) window-based: expired=true => expiry < +1mo, expired=false => expiry >= +1mo
        expired_window = _get_bool(p.get("expired"))
        if expired_window is True:
            qs = qs.filter(license__license_expiry_date__lt=one_month_from_now)
        elif expired_window is False:
            qs = qs.filter(license__license_expiry_date__gte=one_month_from_now)

        # 2) direct field override if provided
        is_expired_flag = _get_bool(p.get("is_expired"))
        if is_expired_flag is not None:
            qs = qs.filter(license__is_expired=is_expired_flag)

        # --- Availability/value floors (apply only when provided) ---
        min_balance_cif = _get_num(p.get("min_balance_cif"), float)
        if min_balance_cif is not None:
            qs = qs.filter(available_value__gte=min_balance_cif)

        min_balance_qty = _get_num(p.get("min_balance_qty"), float)
        if min_balance_qty is not None:
            qs = qs.filter(available_quantity__gte=min_balance_qty)

        # --- SION Norm (by id preferred, fallback to text) ---
        sion_id = (p.get("sion_norm_id") or "").strip()
        if sion_id.isdigit():
            qs = qs.filter(license__export_license__norm_class__id=int(sion_id))
        else:
            sion_txt = (p.get("sion_norms") or "").strip()
            if sion_txt:
                qs = qs.filter(license__export_license__norm_class__norm_class__icontains=sion_txt)

        # --- Free text search ---
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

        # --- Specific field filters ---
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

        # license.is_null
        is_null_flag = _get_bool(p.get("is_null"))
        if is_null_flag is not None:
            qs = qs.filter(license__is_null=is_null_flag)

        # distinct() needed for the join via export_license (SION)
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
