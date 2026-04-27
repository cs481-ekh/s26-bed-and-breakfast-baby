"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
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
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

# Site patterns (before APP_ROOT prefix)
site_patterns = [
    path('admin/', admin.site.urls),
    path("api/", include("api.urls")),
]

# Apply APP_ROOT prefix to all URL patterns
if settings.APP_ROOT:
    urlpatterns = [
        path(settings.APP_ROOT.rstrip('/'), include(site_patterns)),
    ]
else:
    urlpatterns = site_patterns