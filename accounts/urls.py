# accounts/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    ForgotPasswordView,
    ResetPasswordView,
    CustomTokenObtainPairView,
    ProfileView,
    UserListView,
    SetUserPasswordView,
    GetCurrentUserView,
    UserDetailView,
)

app_name = "accounts"

urlpatterns = [
    # Auth / Tokens
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Registration & password
    path('register/', RegisterView.as_view(), name='register'),
    path('password/forgot/', ForgotPasswordView.as_view(), name='password_forgot'),
    path('password/reset/', ResetPasswordView.as_view(), name='password_reset'),

    # Users & profile
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/me/', GetCurrentUserView.as_view(), name='current_user'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('users/<int:pk>/set-password/', SetUserPasswordView.as_view(), name='user_set_password'),

    # (Optional) legacy alias; prefer users/me/
    path('profile/', ProfileView.as_view(), name='profile'),
]
