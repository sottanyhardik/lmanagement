from django.template.loader import render_to_string
from rest_framework import generics
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import make_password

class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        if User.objects.filter(username=data['username']).exists():
            return Response({'error': 'User already exists'}, status=400)
        user = User.objects.create(
            username=data['username'],
            password=make_password(data['password']),
            email=data.get('email', '')
        )
        return Response({'message': 'User created'}, status=status.HTTP_201_CREATED)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

User = get_user_model()

class ForgotPasswordView(APIView):
    def post(self, request):
        email = request.data.get('email')
        user = User.objects.filter(email=email).first()

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"http://localhost:5173/reset/{uid}/{token}"

            subject = 'Reset Your Password'
            from_email = 'admin@yourapp.com'
            to = [email]
            text_content = f'Reset your password here: {reset_url}'
            html_content = render_to_string('password_reset_email.html', {'reset_url': reset_url})

            from django.core.mail import EmailMultiAlternatives
            msg = EmailMultiAlternatives(subject, text_content, from_email, to)
            msg.attach_alternative(html_content, "text/html")
            msg.send()

        # Always return success to avoid exposing if email exists
        return Response({'message': 'If the email exists, a reset link was sent.'}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)

            if default_token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({'success': 'Password has been reset.'})
            else:
                return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception:
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)
