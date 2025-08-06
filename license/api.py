from django.db.models import Q
from rest_framework import filters
from rest_framework import viewsets

from license.models import LicenseDetailsModel
from license.serializers import LicenseDetailsSerializer
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


class LicenseDetailsViewSet(viewsets.ModelViewSet):
    queryset = LicenseDetailsModel.objects.all().prefetch_related('export_license', 'import_license')
    serializer_class = LicenseDetailsSerializer
