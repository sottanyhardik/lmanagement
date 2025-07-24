from django.contrib.auth.decorators import login_required
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from .api import BillOfEntryViewSet

router = DefaultRouter()
router.register(r'bill-of-entries', BillOfEntryViewSet, basename='bill-of-entry')

urlpatterns = [
    path('api/', include(router.urls)),

    path('', login_required(views.BillOfEntryView.as_view()), name='bill-of-entry-list'),
    path('ajax/', login_required(views.BillOfEntryAjaxListView.as_view()), name='bill-of-entry-ajax-list'),
    path('add', login_required(views.BillOfEntryCreateView.as_view()), name='bill-of-entry-create'),
    path('<slug:boe>', login_required(views.BillOfEntryDetailView.as_view()), name='bill-of-entry-detail'),
    path('<slug:pk>/update', login_required(views.BillOfEntryUpdateDetailView.as_view()), name='bill-of-entry-update'),
    path('<slug:pk>/item', login_required(views.BillOfEntryUpdateView.as_view()), name='bill-of-entry-items'),
    path('<slug:boe>/delete', login_required(views.BillOfEntryDeleteView.as_view()), name='bill-of-entry-delete'),
    path('fetch/', login_required(views.BillOfEntryFetchView.as_view()), name='bill_of_entry_fetch'),
    path('download/', login_required(views.DownloadPendingBillView.as_view()), name='bill_of_entry_pending'),
    path('<slug:pk>/tl', login_required(views.GenerateTransferLetterView.as_view()), name='bill-of-entry-tl'),
    path('download/port/', login_required(views.DownloadPortView.as_view()), name='bill_of_entry_download_boe'),
]
