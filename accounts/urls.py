from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import RegisterView, ForgotPasswordView, ResetPasswordView

urlpatterns = [
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
path('api/password/forgot/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('api/password/reset/', ResetPasswordView.as_view(), name='reset-password'),
]
