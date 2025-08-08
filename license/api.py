from django.db.models import Q
from rest_framework import filters
from rest_framework import viewsets

from .models import LicenseImportItemsModel
from .serializers import LicenseImportItemsSelectSerializer


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
