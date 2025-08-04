import csv
import io

from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework import viewsets, filters
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from bill_of_entry.models import BillOfEntryModel
from bill_of_entry.scripts.boe import fetch_cookies, fetch_captcha
from bill_of_entry.scripts.utils import port_dict
from lmanagement.tasks import fetch_data_to_model
from scripts.parse_ledger import parse_license_data
from .filters import SionNormClassFilter
from .models import CompanyModel, PortModel, ItemNameModel, HSCodeModel, ItemHeadModel, SionNormClassModel, \
    HeadSIONNormsModel, TransferLetterModel, InvoiceEntity
from .scripts.ledger import create_object
from .serializers import CompanySerializer, PortSerializer, ItemHeadSerializer, ItemNameSerializer, HSCodeSerializer, \
    SionNormClassSerializer, HeadSIONNormsSerializer, TransferLetterSerializer, InvoiceEntitySerializer


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


class FetchBOEData(APIView):
    """
    GET: Get CAPTCHA + cookies + token + count
    POST: Submit CAPTCHA and trigger fetch tasks
    """

    def get(self, request, *args, **kwargs):
        try:
            cookies, csrftoken = fetch_cookies()
            captcha_url = fetch_captcha(cookies)

            remain_count = BillOfEntryModel.objects.filter(
                Q(is_fetch=False) | Q(appraisement=None) | Q(ooc_date=None) | Q(ooc_date='N.A.')
            ).exclude(failed__gte=5).count()

            remain_captcha = remain_count / 3

            return Response({
                "captcha": captcha_url,
                "csrftoken": csrftoken,
                "cookies": cookies,
                "remain_count": remain_count,
                "remain_captcha": round(remain_captcha, 2)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, *args, **kwargs):
        try:
            captcha = request.data.get('captcha')
            cookies = request.data.get('cookies')
            csrftoken = request.data.get('csrftoken')

            if not (captcha and cookies and csrftoken):
                return Response({'error': 'Missing captcha, cookies, or csrf token'}, status=400)

            data_list = BillOfEntryModel.objects.filter(
                Q(is_fetch=False) | Q(appraisement=None) | Q(ooc_date=None) | Q(ooc_date='N.A.')
            ).exclude(failed__gte=5).order_by('-bill_of_entry_date')[:3]

            triggered_ids = []
            for data in data_list:
                fetch_data_to_model.delay(cookies, csrftoken, port_dict, {}, captcha, data.pk)
                triggered_ids.append(data.pk)

            return Response({
                'status': 'triggered',
                'count': len(triggered_ids),
                'ids': triggered_ids
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadLedgerAPIView(APIView):
    """
    API to upload and process ledger CSV files.
    """

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('ledger')
        if not files:
            return Response({"error": "No files uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        results = []

        for uploaded_file in files:
            try:
                decoded_file = uploaded_file.read().decode('utf-8-sig')
                decoded_file = decoded_file.replace(':', '')
                decoded_file = decoded_file.replace('\xa0', '')
                csvfile = io.StringIO(decoded_file)

                reader = csv.reader(csvfile)
                rows = [row for row in reader if any(field.strip() for field in row)]

                dict_list = parse_license_data(rows)

                created = []
                for dict_data in dict_list:
                    create_object(dict_data)
                    created.append(dict_data.get('lic_no', 'Unknown'))

                results.append({
                    "file": uploaded_file.name,
                    "count": len(created),
                    "licenses": created
                })

            except Exception as e:
                results.append({
                    "file": uploaded_file.name,
                    "error": str(e)
                })

        return Response({"result": results}, status=status.HTTP_200_OK)


class TransferLetterViewSet(viewsets.ReadOnlyModelViewSet):  # ReadOnly to restrict to GET only
    queryset = TransferLetterModel.objects.all()
    serializer_class = TransferLetterSerializer
    pagination_class = None  # ❗ Disable pagination


class InvoiceEntityReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InvoiceEntity.objects.all()
    serializer_class = InvoiceEntitySerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'pan_number', 'gst_number', 'bank_name', 'ifsc_code']
