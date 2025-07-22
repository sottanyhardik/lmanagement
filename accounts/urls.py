from django.urls import path
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

from .views import RegisterView, ForgotPasswordView, ResetPasswordView, CustomTokenObtainPairView, ProfileView, \
    UserListView, SetUserPasswordView, GetCurrentUserView, UserDetailView

urlpatterns = [
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/password/forgot/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('api/password/reset/', ResetPasswordView.as_view(), name='reset-password'),
    path('api/profile/', ProfileView.as_view()),
    path('api/users/', UserListView.as_view()),
    path('api/users/me/', GetCurrentUserView.as_view(), name='get_current_user'),
    path('api/users/<int:pk>/', UserDetailView.as_view()),
    path('api/users/<int:pk>/set_password/', SetUserPasswordView.as_view()),
]
