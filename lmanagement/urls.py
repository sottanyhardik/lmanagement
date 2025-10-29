"""lmanagement URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path

from core.views import DashboardView

urlpatterns = [
    path('admin/', admin.site.urls),

    # APIs
    path('api/', include('core.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('license.urls')),
    path('api/', include('allotment.urls')),
    path('api/', include('bill_of_entry.urls')),
    path('api/', include('trade.urls')),
    # Other app routes
    path('select2/', include('django_select2.urls')),
    path('accounts/', include('django.contrib.auth.urls')),
    path('django-rq/', include('django_rq.urls')),
]

# Static & media in dev
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Debug toolbar only in DEBUG
if settings.DEBUG:
    try:
        from debug_toolbar.toolbar import debug_toolbar_urls

        urlpatterns += debug_toolbar_urls()
    except Exception:
        try:
            import debug_toolbar

            urlpatterns.insert(0, path('__debug__/', include(debug_toolbar.urls)))
        except Exception:
            pass

# React SPA catch-all using DashboardView
urlpatterns += [
    re_path(
        r'^(?!static/|media/|admin/|api/|select2/|accounts/|django-rq/|ebrc/|shipping/|reports/|__debug__/).*$',
        DashboardView.as_view(),
        name='dashboard',
    )
]
