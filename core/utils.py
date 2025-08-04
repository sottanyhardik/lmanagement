from datetime import datetime

import num2words
from django.http import HttpResponse
from django.template.loader import get_template
from django.utils.dateparse import parse_datetime, parse_date
from django_tables2 import SingleTableView
from django_tables2.export import ExportMixin
from xhtml2pdf import pisa


def number_to_words(amount):
    try:
        return num2words.num2words(amount, to='currency', lang='en_IN').replace('euro', 'rupees').capitalize()
    except Exception:
        return ""


class PagedFilteredTableView(ExportMixin, SingleTableView):
    filter_class = None
    context_filter_name = 'filter'
    page_head = None

    def get_queryset(self, **kwargs):
        qs = super(PagedFilteredTableView, self).get_queryset()
        if self.filter_class:
            self.filter = self.filter_class(self.request.GET, queryset=qs)
            return self.filter.qs
        else:
            return qs

    def get_context_data(self, **kwargs):
        context = super(PagedFilteredTableView, self).get_context_data()
        if self.filter_class:
            context[self.context_filter_name] = self.filter_class(self.request.GET, queryset=self.model.objects.all())
        context['page_head'] = self.page_head
        return context


def render_to_pdf(template_src, context_dict={}):
    template = get_template(template_src)
    html = template.render(context_dict)
    response = HttpResponse(content_type='application/pdf')
    pisa_status = pisa.CreatePDF(html, dest=response)
    if pisa_status.err:
        return HttpResponse('Error rendering PDF', status=500)
    return response


def safe_parse_datetime(value):
    """Parse date or datetime from various formats safely."""
    if not value:
        return None
    # Try ISO format first
    dt = parse_datetime(value)
    if dt:
        return dt
    # Try ISO date
    dt = parse_date(value)
    if dt:
        return datetime.combine(dt, datetime.min.time())
    # Try custom 'DD/MM/YYYY'
    try:
        return datetime.strptime(value, '%d/%m/%Y')
    except Exception:
        pass
    # Try fallback format
    try:
        return datetime.strptime(value, '%d-%m-%Y')
    except Exception:
        pass
    return None


def safe_parse_date(value):
    dt = safe_parse_datetime(value)
    return dt.date() if dt else None
