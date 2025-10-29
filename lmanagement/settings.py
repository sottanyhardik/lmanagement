"""
Django settings for lmanagement project.
"""

import os
from pathlib import Path
from urllib.parse import quote

import django
from decouple import config  # optional; keep if you use it elsewhere

# -----------------------------------------------------------
# BASE PATHS
# -----------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# -----------------------------------------------------------
# SECURITY
# -----------------------------------------------------------
SECRET_KEY = 'cn^fjh#*dhrjzrzphy!ic-2u())f(*wju3u_(06f^zq!g@_%o('
DEBUG = True
ALLOWED_HOSTS = [
    '167.71.233.211',
    'localhost',
    '127.0.0.1',
    '143.110.186.184',
]

# -----------------------------------------------------------
# APPLICATIONS
# -----------------------------------------------------------
INSTALLED_APPS = [
    # Django core
    'django.contrib.admin',
    'accounts.apps.AccountsConfig',

    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',

    # Third-party
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'django_extensions',
    'extra_views',
    'django_select2',
    'django_tables2',
    'djangoformsetjs',
    'mathfilters',
    'django_vite',

    # Project apps
    'core.apps.CoreConfig',
    'license.apps.LicenseConfig',
    'bill_of_entry.apps.BillOfEntryConfig',
    'allotment.apps.AllotmentConfig',
    'license_movement.apps.LicenseMovementConfig',
    'trade.apps.TradeConfig',
    'django.contrib.humanize',
    'mathfilters',
]

# -----------------------------------------------------------
# MIDDLEWARE
# -----------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CORS first
    'django.middleware.security.SecurityMiddleware',
    *([] if DEBUG else ['whitenoise.middleware.WhiteNoiseMiddleware']),
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # OK to keep (GETs only for SPA; DRF+JWT skips CSRF)
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# -----------------------------------------------------------
# URLS / WSGI
# -----------------------------------------------------------
ROOT_URLCONF = 'lmanagement.urls'
WSGI_APPLICATION = 'lmanagement.wsgi.application'

# -----------------------------------------------------------
# TEMPLATES
# -----------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'frontend' / 'dist',  # React build (index.html)
            BASE_DIR / 'templates',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# -----------------------------------------------------------
# DATABASE
# -----------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'lmanagement',
        'USER': 'lmanagement',
        'PASSWORD': 'lmanagement',
        'HOST': 'localhost',
        'PORT': '',
    }
}

# -----------------------------------------------------------
# AUTH / LOGIN REDIRECTS
# -----------------------------------------------------------
from django.urls import reverse_lazy

LOGIN_URL = reverse_lazy('login')
LOGIN_REDIRECT_URL = reverse_lazy('dashboard')
LOGOUT_REDIRECT_URL = reverse_lazy('login')

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# -----------------------------------------------------------
# INTERNATIONALIZATION
# -----------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = False
USE_TZ = True
DATE_FORMAT = "d-m-Y"
DATETIME_FORMAT = "d-m-Y"

# -----------------------------------------------------------
# STATIC & MEDIA
# -----------------------------------------------------------
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / "frontend" / "dist",  # built assets
]
STATIC_ROOT = BASE_DIR / "static_cdn"

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / "media"

# -----------------------------------------------------------
# CACHES
# -----------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    },
    'select2': {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/2",
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}
SELECT2_CACHE_BACKEND = 'select2'

# -----------------------------------------------------------
# FILE UPLOAD
# -----------------------------------------------------------
FILE_UPLOAD_HANDLERS = (
    'django.core.files.uploadhandler.TemporaryFileUploadHandler',
)

# -----------------------------------------------------------
# RQ QUEUES
# -----------------------------------------------------------
RQ_QUEUES = {
    'default': {'HOST': 'localhost', 'PORT': 6379, 'DB': 0, 'DEFAULT_TIMEOUT': 1200},
    'with-sentinel': {
        'SENTINELS': [('localhost', 26736), ('localhost', 26737)],
        'MASTER_NAME': 'redismaster',
        'DB': 0,
        'PASSWORD': 'secret',
        'SOCKET_TIMEOUT': None,
        'CONNECTION_KWARGS': {'socket_connect_timeout': 0.3},
    },
    'high': {'URL': os.getenv('REDISTOGO_URL', 'redis://localhost:6379/0'), 'DEFAULT_TIMEOUT': 500},
    'low': {'HOST': 'localhost', 'PORT': 6379, 'DB': 0},
}

# -----------------------------------------------------------
# DJANGO TABLES2
# -----------------------------------------------------------
DJANGO_TABLES2_TEMPLATE = "django_tables2/bootstrap.html"

# -----------------------------------------------------------
# EMAIL (file-based for dev)
# -----------------------------------------------------------
EMAIL_BACKEND = "django.core.mail.backends.filebased.EmailBackend"
EMAIL_FILE_PATH = BASE_DIR / "sent_emails"

# -----------------------------------------------------------
# MISC
# -----------------------------------------------------------
USE_THOUSAND_SEPARATOR = True
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'
EXPIRY_DAY = 60
DATA_UPLOAD_MAX_NUMBER_FIELDS = 50000

# -----------------------------------------------------------
# DJANGO VITE
# -----------------------------------------------------------
DJANGO_VITE = {
    "default": {
        "manifest_path": BASE_DIR / 'frontend' / 'dist' / '.vite' / 'manifest.json',
    }
}
DJANGO_VITE_DEV_MODE = False
DJANGO_VITE_DEV_SERVER_PORT = 5173

# -----------------------------------------------------------
# CORS / CSRF (JWT-only API: no cookies)
# -----------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://143.110.186.184",
]
CORS_ALLOW_CREDENTIALS = False  # JWT mode → do not send cookies cross-origin

# CSRF is retained for any server-rendered Django views/admin.
# DRF endpoints using JWTAuthentication won't enforce CSRF.
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://143.110.186.184",
]

# -----------------------------------------------------------
# DRF (JWT only)
# -----------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_FILTER_BACKENDS': [
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

CORS_ALLOW_HEADERS = list({
    "authorization",
    "content-type",
    "accept",
    "origin",
    "user-agent",
    "x-requested-with",
})
AUTH_USER_MODEL = "accounts.User"
