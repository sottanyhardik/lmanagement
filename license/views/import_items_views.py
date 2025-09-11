# views.py

from django.db.models import Q
from rest_framework import viewsets, filters

from license.models import LicenseImportItemsModel
from license.serializers import LicenseImportItemsSelectSerializer


class LicenseImportItemsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only SR items with:
      - Search via `?search=` (DRF SearchFilter) and `?display_name=LIC-123 - 07`
      - GET /api/license-import-items/<pk>/metrics/
    """
    # permission_classes = [permissions.IsAuthenticated]
    serializer_class = LicenseImportItemsSelectSerializer

    # Efficient base queryset
    queryset = (
        LicenseImportItemsModel.objects
        .select_related("license")
        .all()
        .order_by("-license__license_expiry_date", "id")
        .distinct()
    )

    # Standard DRF search (in addition to the custom display_name param)
    filter_backends = [filters.SearchFilter]
    # Adjust/extend fields to match your model
    search_fields = [
        "serial_number",
        "license__license_number",
        # Uncomment/add if present on your model:
        # "license__iec",
        # "item_description",
    ]

    def get_queryset(self):
        """
        Supports a UX-friendly `display_name` query param that can be either:
          - "LIC-NO - SR"  (preferred)
          - "LIC-NO–SR"    (common copy-paste dash variants)
        Falls back to partial matching on license number if not in the "A - B" form.
        """
        qs = super().get_queryset()
        display_name = self.request.query_params.get("display_name")

        if display_name:
            # Normalize dash variants and spaces around the dash
            normalized = display_name.replace("–", "-").replace("—", "-")
            # Try split on ' - ' first, then a single '-' if needed
            if " - " in normalized:
                lic_part, sr_part = normalized.split(" - ", 1)
                lic_part, sr_part = lic_part.strip(), sr_part.strip()
                if lic_part and sr_part:
                    return qs.filter(
                        license__license_number__icontains=lic_part,
                        serial_number__icontains=sr_part,
                    ).distinct()
            elif "-" in normalized:
                lic_part, sr_part = normalized.split("-", 1)
                lic_part, sr_part = lic_part.strip(), sr_part.strip()
                if lic_part and sr_part:
                    return qs.filter(
                        license__license_number__icontains=lic_part,
                        serial_number__icontains=sr_part,
                    ).distinct()

            # If not a split-able pattern, do a helpful partial search on the license number
            return qs.filter(
                Q(license__license_number__istartswith=display_name)
                | Q(license__license_number__iendswith=display_name)
                | Q(license__license_number__icontains=display_name)
            ).distinct()

        return qs
