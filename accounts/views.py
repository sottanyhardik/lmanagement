# accounts/views.py
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from rest_framework import generics
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAdminUser
# accounts/views.py (add this)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import UserSerializer

User = get_user_model()


# ---------------------------
# Auth / Tokens
# ---------------------------

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Adds a few useful claims to the access token and response payload.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['full_name'] = user.get_full_name()
        token['is_superuser'] = user.is_superuser
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        data['full_name'] = self.user.get_full_name()
        data['is_superuser'] = self.user.is_superuser
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]  # explicit for clarity
    serializer_class = CustomTokenObtainPairSerializer


# ---------------------------
# Registration
# ---------------------------

class RegisterView(generics.CreateAPIView):
    """
    Simple user registration endpoint.
    In production, you may want to use a DRF serializer with stronger validation.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        email = (request.data.get('email') or '').strip()

        if not username or not password:
            return Response({'error': 'Username and password are required.'}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'User already exists.'}, status=400)

        # Creates user with a hashed password
        User.objects.create_user(username=username, password=password, email=email)
        return Response({'message': 'User created.'}, status=status.HTTP_201_CREATED)


# ---------------------------
# Password reset (email link)
# ---------------------------

class ForgotPasswordView(APIView):
    """
    Always returns 200 to avoid email enumeration.
    Sends a reset link to the frontend SPA: <FRONTEND_BASE_URL>/reset/<uid>/<token>
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        email = (request.data.get('email') or '').strip()
        user = User.objects.filter(email=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            from django.contrib.auth.tokens import default_token_generator
            token = default_token_generator.make_token(user)

            frontend_base = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
            reset_url = f"{frontend_base.rstrip('/')}/reset/{uid}/{token}"

            subject = 'Reset Your Password'
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'admin@yourapp.com')
            to = [email]
            text_content = f'Reset your password here: {reset_url}'
            html_content = render_to_string('password_reset_email.html', {'reset_url': reset_url})

            msg = EmailMultiAlternatives(subject, text_content, from_email, to)
            msg.attach_alternative(html_content, "text/html")
            msg.send()

        return Response({'message': 'If the email exists, a reset link was sent.'}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    Consumes uid + token + new_password and resets the password if valid.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        uidb64 = request.data.get('uid') or ''
        token = request.data.get('token') or ''
        new_password = request.data.get('new_password') or ''

        if not new_password:
            return Response({'error': 'New password is required.'}, status=400)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)

            from django.contrib.auth.tokens import default_token_generator
            if default_token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({'success': 'Password has been reset.'})
            return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------
# Profile / Users
# ---------------------------

class GetCurrentUserView(RetrieveAPIView):
    """
    Returns the current authenticated user (JWT Bearer required).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileView(APIView):
    """
    Basic profile GET/PUT for the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        u = request.user
        return Response({
            'first_name': u.first_name,
            'last_name': u.last_name,
            'email': u.email
        })

    def put(self, request, *args, **kwargs):
        u = request.user
        for field in ['first_name', 'last_name', 'email']:
            val = request.data.get(field)
            if val is not None:
                setattr(u, field, val)
        u.save()
        return Response({'detail': 'Profile updated'})


class UserListView(ListAPIView):
    """
    Admin-only list of users.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    queryset = User.objects.all().order_by('id')


class UserDetailView(RetrieveUpdateAPIView):
    """
    Admin-only retrieve/update a specific user.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]


class SetUserPasswordView(APIView):
    """
    Admin-only: set a user's password directly.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk, *args, **kwargs):
        user = get_object_or_404(User, pk=pk)
        new_password = request.data.get('password') or ''
        if not new_password:
            return Response({'error': 'Password is required.'}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password updated'})


class ChangePasswordView(APIView):
    """
    Authenticated user can change their own password by providing old + new.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        old_password = (request.data.get('old_password') or '').strip()
        new_password = (request.data.get('new_password') or '').strip()

        errors = {}
        if not old_password:
            errors['old_password'] = ['This field is required.']
        if not new_password:
            errors['new_password'] = ['This field is required.']
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.check_password(old_password):
            return Response({'old_password': ['Incorrect password.']}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password changed successfully.'}, status=status.HTTP_200_OK)
