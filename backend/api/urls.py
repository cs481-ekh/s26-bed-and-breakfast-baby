from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacilityAvailabilityView, HealthView, UserViewSet, SignUpView  # add SignUpView

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("facilities/availability/", FacilityAvailabilityView.as_view()),
    path("signup/", SignUpView.as_view()),  # add this line
    path("", include(router.urls)),
]