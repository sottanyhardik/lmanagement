from django.db.models import Q
from rest_framework import viewsets, filters

from .models import LicenseImportItemsModel
from .serializers import LicenseImportItemsSelectSerializer


class LicenseImportItemsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LicenseImportItemsModel.objects.select_related('license').all()
    serializer_class = LicenseImportItemsSelectSerializer
    filter_backends = [filters.SearchFilter]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search and ' - ' in search:
            license_part, sr_part = search.split(' - ', 1)
            queryset = queryset.filter(
                license__license_number__icontains=license_part.strip(),
                serial_number__icontains=sr_part.strip()
            )
        elif search:
            queryset = queryset.filter(
                Q(license__license_number__icontains=search) |
                Q(serial_number__icontains=search)
            )
        return queryset
