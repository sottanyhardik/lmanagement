from rest_framework.routers import DefaultRouter

from .views import LicenseTradeViewSet, LicenseTradePaymentViewSet

router = DefaultRouter()
router.register(r"trades", LicenseTradeViewSet, basename="trade")
router.register(r"trade-payments", LicenseTradePaymentViewSet, basename="trade-payment")
urlpatterns = router.urls
