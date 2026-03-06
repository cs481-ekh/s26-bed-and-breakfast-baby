<<<<<<< HEAD
from django.urls import path
from .views import HealthView, SignUpView

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("signup/", SignUpView.as_view()),
=======
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthView, UserViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("", include(router.urls)),
>>>>>>> f0f32d66962b75194dabb20063062788644f3bdd
]
