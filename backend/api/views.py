from django.shortcuts import render
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets
from housing.models import User
from .serializers import UserSerializer

class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing users.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_queryset(self):
        return User.objects.all().order_by('-date_joined')

