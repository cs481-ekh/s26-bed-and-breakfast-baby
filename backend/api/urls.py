from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FacilityAvailabilityView,
    FacilityBedsView,
    HealthView,
    UserViewSet,
    SignUpView,
    ParoleeListView,
    BedAssignView,
    BedHoldRequestView,
    BedUnassignView,
    BedNotesUpdateView,
    BedUnassignAllView,
    CurrentUserView,
    ProviderBedsView,
    ProviderAssignClientView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    path("health/", HealthView.as_view()),
    path("me/", CurrentUserView.as_view()),
    path("facilities/availability/", FacilityAvailabilityView.as_view()),
    path("facilities/<int:facility_id>/beds/", FacilityBedsView.as_view()),
    path("parolees/", ParoleeListView.as_view()),
    path("beds/<int:bed_id>/assign/", BedAssignView.as_view()),
    path("beds/<int:bed_id>/hold/", BedHoldRequestView.as_view()),
    path("beds/<int:bed_id>/unassign/", BedUnassignView.as_view()),
    path("beds/<int:bed_id>/notes/", BedNotesUpdateView.as_view()),
    path("beds/unassign-all/", BedUnassignAllView.as_view()),
    path("provider/beds/", ProviderBedsView.as_view()),
    path("provider/assign-client/", ProviderAssignClientView.as_view()),
    path("signup/", SignUpView.as_view()),
    path("", include(router.urls)),
]