# trades/views/payment_views.py
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.exceptions import ValidationError

from ..models import LicenseTradePayment
from ..serializers import LicenseTradePaymentSerializer


class LicenseTradePaymentViewSet(viewsets.ModelViewSet):
    queryset = LicenseTradePayment.objects.select_related("trade").all()
    serializer_class = LicenseTradePaymentSerializer

    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ["trade"]  # allow /api/trade-payments/?trade=<id>
    search_fields = ["note"]
    ordering = ["-date", "-id"]

    def perform_create(self, serializer):
        # If client didn't send trade_id in body, let ?trade=<id> work as a convenience.
        trade = serializer.validated_data.get("trade")
        if not trade:
            trade_id = self.request.data.get("trade") or self.request.query_params.get("trade")
            if not trade_id:
                raise ValidationError({"trade_id": "This field is required."})
            serializer.save(trade_id=trade_id)
        else:
            serializer.save()
