import django_filters
from django.db import models
from django.db.models import Q

BOOLEAN_CHOICES = (
    (True, 'Yes'),
    (False, 'No')
)


class ListFilter(django_filters.Filter):
    def filter(self, queryset, value):
        if value:
            value_list = value.split(u',')
            queryset = queryset.filter(item_details__sr_number__license__license_number__in=value_list).distinct()
            return queryset
        elif value == "":
            return queryset
        else:
            return queryset


class ListBOEFilter(django_filters.Filter):
    def filter(self, queryset, value):
        if value:
            value_list = value.split(u',')
            queryset = queryset.filter(bill_of_entry_number__in=value_list).distinct()
            return queryset
        elif value == "":
            return queryset
        else:
            return queryset


from .models import BillOfEntryModel


class BillOfEntryFilter(django_filters.FilterSet):
    from_date = django_filters.DateFilter(field_name="bill_of_entry_date", lookup_expr='gte')
    to_date = django_filters.DateFilter(field_name="bill_of_entry_date", lookup_expr='lte')
    company__in = django_filters.CharFilter(method='filter_company_in')
    exclude_company__in = django_filters.CharFilter(method='filter_exclude_company_in')

    port__in = django_filters.CharFilter(method='filter_port_in')
    exclude_port__in = django_filters.CharFilter(method='filter_exclude_port_in')

    is_ge = django_filters.BooleanFilter(method='check_self', label='GE only')
    item_details__sr_number__license__license_number = ListFilter(
        field_name='item_details__sr_number__license__license_number', label='License Numbers'
    )
    is_invoice = django_filters.BooleanFilter(method='check_is_invoice', label='Has Invoice')
    is_ooc = django_filters.BooleanFilter(method='check_is_ooc', label='Is OOC')
    bill_of_entry_number = ListBOEFilter(
        field_name='bill_of_entry_number', label='BOE Numbers'
    )

    class Meta:
        model = BillOfEntryModel
        fields = [
            'company', 'bill_of_entry_number',
            'port', 'product_name', 'is_ge',
            'item_details__sr_number__license__license_number'
        ]
        filter_overrides = {
            models.CharField: {
                'filter_class': django_filters.CharFilter,
                'extra': lambda f: {'lookup_expr': 'icontains'},
            },
            models.TextField: {
                'filter_class': django_filters.CharFilter,
                'extra': lambda f: {'lookup_expr': 'icontains'},
            }
        }

    def filter_company_in(self, queryset, name, value):
        if not value:
            return queryset
        ids = [v for v in value.split(',') if v]
        return queryset.filter(company_id__in=ids)

    def filter_exclude_company_in(self, queryset, name, value):
        if not value:
            return queryset
        ids = [v for v in value.split(',') if v]
        return queryset.exclude(company_id__in=ids)

    def filter_port_in(self, queryset, name, value):
        if not value:
            return queryset
        ids = [v for v in value.split(',') if v]
        return queryset.filter(port_id__in=ids)

    def filter_exclude_port_in(self, queryset, name, value):
        if not value:
            return queryset
        ids = [v for v in value.split(',') if v]
        return queryset.exclude(port_id__in=ids)

    def check_self(self, queryset, name, value):
        if value:
            return queryset.filter(item_details__sr_number__license__purchase_status='GE').distinct()
        return queryset

    def check_is_invoice(self, queryset, name, value):
        if str(value).lower() == 'true':
            return queryset.exclude(invoice_no__isnull=True).exclude(invoice_no__exact='')
        elif str(value).lower() == 'false':
            return queryset.filter(Q(invoice_no__isnull=True) | Q(invoice_no__exact=''))
        return queryset

    def check_is_ooc(self, queryset, name, value):
        if value:
            return queryset.exclude(Q(ooc_date=None) | Q(ooc_date='N.A.'))
        else:
            return queryset.filter(Q(ooc_date=None) | Q(ooc_date='N.A.'))
