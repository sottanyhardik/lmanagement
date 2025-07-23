from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.pagination import PageNumberPagination

from .filters import SionNormClassFilter
from .models import CompanyModel, PortModel, ItemNameModel, HSCodeModel, ItemHeadModel, SionNormClassModel, \
    HeadSIONNormsModel
from .serializers import CompanySerializer, PortSerializer, ItemHeadSerializer, ItemNameSerializer, HSCodeSerializer, \
    SionNormClassSerializer, HeadSIONNormsSerializer


class CustomPagination(PageNumberPagination):
    page_size_query_param = '5'


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = CompanyModel.objects.all()
    serializer_class = CompanySerializer
    pagination_class = CustomPagination  # ✅ add this
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['iec', 'name']
    ordering_fields = ['iec', 'name']
    ordering = ['-modified_on']  # Default: newest first


class PortViewSet(viewsets.ModelViewSet):
    queryset = PortModel.objects.all()
    serializer_class = PortSerializer
    pagination_class = CustomPagination  # ✅ add this
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']
    ordering = ['-modified_on']  # Default: newest first


class ItemHeadViewSet(viewsets.ModelViewSet):
    queryset = ItemHeadModel.objects.all()
    serializer_class = ItemHeadSerializer
    pagination_class = CustomPagination  # ✅ add this
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]  # ✅ add this
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['-modified_on']  # Default: newest first


class ItemNameViewSet(viewsets.ModelViewSet):
    queryset = ItemNameModel.objects.select_related('head').all()
    serializer_class = ItemNameSerializer
    pagination_class = CustomPagination  # ✅
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]  # ✅
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['-modified_on']  # Default: newest first


class HSCodeViewSet(viewsets.ModelViewSet):
    queryset = HSCodeModel.objects.all()
    serializer_class = HSCodeSerializer
    pagination_class = CustomPagination  # ✅
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]  # ✅
    search_fields = ['hs_code', 'product_description']
    ordering_fields = ['hs_code', 'product_description']
    ordering = ['-modified_on']  # Default: newest first


class SionNormClassViewSet(viewsets.ModelViewSet):
    queryset = SionNormClassModel.objects.all()
    serializer_class = SionNormClassSerializer
    pagination_class = CustomPagination

    filter_backends = [
        DjangoFilterBackend,  # ✅ Add this
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_class = SionNormClassFilter
    filterset_fields = ['head_norm']  # ✅

    search_fields = ['norm_class', 'description', 'export_norm__description', 'import_norm__description']
    ordering_fields = ['norm_class']
    ordering = ['-modified_on']  # Default: newest first

    # permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(modified_by=self.request.user)


class HeadSIONNormsViewSet(viewsets.ModelViewSet):
    queryset = HeadSIONNormsModel.objects.all()
    serializer_class = HeadSIONNormsSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']
