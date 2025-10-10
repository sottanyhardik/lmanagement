from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator

User = get_user_model()

class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='secret123')

    def test_send_password_reset_email(self):
        url = reverse('forgot-password')
        response = self.client.post(url, {'email': 'test@example.com'})
        self.assertEqual(response.status_code, 200)

    def test_reset_password_success(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        url = reverse('reset-password')
        data = {'uid': uid, 'token': token, 'new_password': 'newsecret123'}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newsecret123'))

    def test_reset_password_invalid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        url = reverse('reset-password')
        data = {'uid': uid, 'token': 'invalidtoken', 'new_password': 'whatever123'}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
