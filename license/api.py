from django.db.models import Q
from rest_framework import filters
from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination

from .models import LicenseImportItemsModel
from .serializers import LicenseImportItemsSelectSerializer


class SmallPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class LicenseImportItemsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LicenseImportItemsModel.objects.select_related('license').all().order_by(
        '-license__license_expiry_date').distinct()
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


from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from license.models import LicenseDetailsModel
from license.serializers import LicenseDetailsSerializer


class LicenseDetailsViewSet(viewsets.ModelViewSet):
    queryset = LicenseDetailsModel.objects.all().prefetch_related(
        'export_license', 'import_license'
    ).distinct()
    serializer_class = LicenseDetailsSerializer

    # ✅ Enable filtering and search
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    # ✅ Fields you want to allow for filtering
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

    # ✅ Fields you want to allow for search (case-insensitive, partial match)
    search_fields = [
        'license_number',
        'file_number',
        'notification_number',
        'scheme_code',
        'exporter__name',
        'port__name',
    ]

    # ✅ Optional: Enable ordering
    ordering_fields = ['license_date', 'license_expiry_date', 'modified_on']
    ordering = ['-modified_on']  # Default order


class LicenseImportItemsSelectView(ListAPIView):
    """
    GET /api/license-import-items/select/?q=&license_number=&sion_norms=&description=&hs_code=
        &notification_number=&expired=(true|false)&is_null=(true|false)
    """
    serializer_class = LicenseImportItemsSelectSerializer
    pagination_class = SmallPagination

    def get_queryset(self):
        p = self.request.query_params
        qs = (
            LicenseImportItemsModel.objects
            .select_related("license", "hs_code")
            .all()
        )

        q = (p.get("q") or "").strip()
        if q:
            q_filter = (
                    Q(license__license_number__icontains=q) |
                    Q(description__icontains=q) |
                    Q(hs_code__hs_code__icontains=q)
            )
            if q.isdigit():
                q_filter = q_filter | Q(serial_number=int(q))
            qs = qs.filter(q_filter)

        lic_no = (p.get("license_number") or "").strip()
        if lic_no:
            qs = qs.filter(license__license_number__icontains=lic_no)

        sion = (p.get("sion_norms") or "").strip()
        if sion:
            # through export items' norm class on the same license
            qs = qs.filter(license__export_license__norm_class__norm_class__icontains=sion)

        desc = (p.get("description") or "").strip()
        if desc:
            qs = qs.filter(description__icontains=desc)

        hs = (p.get("hs_code") or "").strip()
        if hs:
            qs = qs.filter(hs_code__hs_code__icontains=hs)

        notif = (p.get("notification_number") or "").strip()
        if notif:
            qs = qs.filter(license__notification_number__icontains=notif)

        expired = p.get("expired")
        if expired in ("true", "false"):
            qs = qs.filter(license__is_expired=(expired == False))

        is_null = p.get("is_null")
        if is_null in ("true", "false"):
            qs = qs.filter(license__is_null=(is_null == False))

        # distinct() is needed because of the join via export_license for sion_norms
        return qs.distinct().order_by(
            "license__license_expiry_date",
            "license__license_number",
            "serial_number"
        )
