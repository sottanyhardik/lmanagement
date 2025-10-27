# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .Export.item_excel import LicenseImportItemsXLSX
from .Export.item_pdf import LicenseImportItemsUltraWidePDF
from .api import (
    LicenseDetailsViewSet,
    LicenseImportItemsSelectView,
    BiscuitReportAPIView,
    LicensePurchaseViewSet,
)
from .views.import_items_views import LicenseImportItemsViewSet
from .views.reports_views import LicenseReportView

router = DefaultRouter()
router.register(r"license-import-items", LicenseImportItemsViewSet, basename="license-import-items")
router.register(r"license-purchases", LicensePurchaseViewSet, basename="license-purchase")
router.register(r"licenses", LicenseDetailsViewSet)

urlpatterns = [
    path("license-import-items/select/", LicenseImportItemsSelectView.as_view(), name="license-import-items-select"),
    path("licenses/export/", LicenseReportView.as_view(), name="license-report-pdf"),
    path("licenses/export/excel/", LicenseImportItemsXLSX.as_view(), name="licenses-export-xlsx"),
    path("licenses/biscuit-report/<str:party>/<str:status_flag>/", BiscuitReportAPIView.as_view(),
         name="biscuit-report"),
    path("", include(router.urls)),
]
