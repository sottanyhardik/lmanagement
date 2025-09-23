from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LicenseTradeViewSet, LicenseTradePaymentViewSet
from .views.views_invoice import LicenseTradeInvoicePDFView

router = DefaultRouter()
router.register(r"trades", LicenseTradeViewSet, basename="trade")
router.register(r"trade-payments", LicenseTradePaymentViewSet, basename="trade-payment")
urlpatterns = [
    path("trades/<int:pk>/invoice-pdf/", LicenseTradeInvoicePDFView.as_view(),
         name="license_trade_invoice_pdf"),
]

urlpatterns = urlpatterns + router.urls
