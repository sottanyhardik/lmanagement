from django.contrib.auth.decorators import login_required
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from .api import CompanyViewSet, PortViewSet, ItemHeadViewSet, ItemNameViewSet, HSCodeViewSet, SionNormClassViewSet, \
    HeadSIONNormsViewSet, FetchBOEData, UploadLedgerAPIView, TransferLetterViewSet, InvoiceEntityReadOnlyViewSet, \
    ChoicesAPIView  # ✅

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'ports', PortViewSet, basename='port')
router.register(r'item-heads', ItemHeadViewSet, basename='item_head')
router.register(r'item-names', ItemNameViewSet, basename='item_name')
router.register(r'hs-codes', HSCodeViewSet, basename='hs_code')
router.register(r'sion-classes', SionNormClassViewSet, basename='sion_norms')
router.register(r'head-norms', HeadSIONNormsViewSet, basename='head_norms')
router.register(r'transfer-letters', TransferLetterViewSet, basename='transfer-letters')
router.register(r'invoice-entities', InvoiceEntityReadOnlyViewSet, basename='invoice-entity')

urlpatterns = [
    path('api/choices/', ChoicesAPIView.as_view(), name='choices'),
    path('api/', include(router.urls)),
    path('api/iecgate/fetch', FetchBOEData.as_view(), name='fetch-boe-details'),
    path('api/ledger/upload/', UploadLedgerAPIView.as_view(), name='upload-ledger-api'),

    # ex: /polls/
    path('', login_required(views.DashboardView.as_view()), name='dashboard'),
    path('company/add', login_required(views.CreateCompanyView.as_view()), name='company-add'),
    path('company/', login_required(views.ListCompanyView.as_view()), name='company-list'),
    path('company/<int:pk>/update/', login_required(views.UpdateCompanyView.as_view()), name='company-update'),
    path('sion/', login_required(views.ListSionView.as_view()), name='Sion-list'),
    path('sion/<int:pk>/update/', login_required(views.UpdateSionView.as_view()), name='Sion-update'),
    path('sion/<int:pk>/', login_required(views.SionDetailView.as_view()), name='Sion-detail'),
    path('hs_code/add/', login_required(views.CreateHSNCodeView.as_view()), name='hs-code-add'),
    path('hs_code/', login_required(views.ListHSNView.as_view()), name='hs-code-list'),
    path('hs_code/<int:pk>/update/', login_required(views.UpdateHSNCodeView.as_view()), name='hs-code-update'),
    path('item/add/', login_required(views.CreateItemView.as_view()), name='item-add'),
    path('item/', login_required(views.ListItemView.as_view()), name='item-list'),
    path('item/<int:pk>/update/', login_required(views.UpdateItemView.as_view()), name='item-update'),
    path('ledger/', login_required(views.UploadLedger.as_view()), name='ledger-upload'),
    path('ledger_complete/', login_required(views.LedgerSuccess.as_view()), name='ledger-complete'),
    path('meis/upload/', login_required(views.UploadMEISView.as_view()), name='meis-upload'),
    path('meis/generate/', login_required(views.GenerateTransferLetterMEISView.as_view()), name='generate_tl'),
    path('api/update-license-transfer/', views.save_license_transfer, name='save_license_transfer'),
]

urlpatterns = router.urls + urlpatterns
