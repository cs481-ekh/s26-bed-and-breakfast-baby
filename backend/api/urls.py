from django.urls import path
from .views import HealthView, SignUpView

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("signup/", SignUpView.as_view()),
]
