# Create your views here.
from datetime import date
from decimal import Decimal
from pathlib import Path
from shutil import make_archive

from django.conf import settings
from django.db.models import Prefetch
from django.db.models import Q
from django.http import HttpResponse
from django.http import HttpResponseRedirect
from django.urls import reverse, reverse_lazy
from django.utils.timezone import now
from django.views.generic import DetailView, FormView, DeleteView, UpdateView, CreateView
from django_filters.views import FilterView
from django_tables2 import SingleTableView
from django_tables2.export import ExportMixin
from easy_pdf.views import PDFTemplateResponseMixin
from extra_views import UpdateWithInlinesView, InlineFormSetFactory
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side
from openpyxl.utils import get_column_letter
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from allotment.scripts.aro import generate_tl_software
from bill_of_entry.models import RowDetails
from core.models import TransferLetterModel
from core.utils import render_to_pdf
from lmanagement.tasks import fetch_data_to_model
from . import forms, tables, filters
from . import models as bill_of_entry
from .filters import BillOfEntryFilter
from .models import BillOfEntryModel


class BillOfEntryView(FilterView, ExportMixin, SingleTableView):
    template_name = 'bill_of_entry/list.html'
    model = bill_of_entry.BillOfEntryModel
    table_class = tables.BillOfEntryTable
    filterset_class = filters.BillOfEntryFilter
    paginate_by = 50
    ordering = '-bill_of_entry_date'


class BillOfEntryAjaxListView(FilterView):
    template_name = 'bill_of_entry/ajax_list.html'
    model = bill_of_entry.BillOfEntryModel
    table_class = tables.BillOfEntryTable
    filterset_class = filters.BillOfEntryFilter
    paginate_by = 50
    ordering = '-bill_of_entry_date'


class BillOfEntryCreateView(CreateView):
    template_name = 'bill_of_entry/add.html'
    model = bill_of_entry.BillOfEntryModel
    form_class = forms.BillOfEntryForm

    def get_context_data(self, **kwargs):
        context = super(BillOfEntryCreateView, self).get_context_data(**kwargs)
        context['inline'] = True
        return context


class BillOfEntryDetailView(DetailView):
    template_name = 'bill_of_entry/card.html'
    model = bill_of_entry.BillOfEntryModel

    def get_object(self, queryset=None):
        object = self.model.objects.get(bill_of_entry_number=self.kwargs.get('boe'))
        return object

    def get_context_data(self, **kwargs):
        context = super(BillOfEntryDetailView, self).get_context_data(**kwargs)
        context['important'] = 'show active'
        return context


class BillOfEntryLicenseImportItemInline(InlineFormSetFactory):
    model = bill_of_entry.RowDetails
    form_class = forms.ImportItemsForm
    factory_kwargs = {
        'extra': 0,
    }


class BillOfEntryUpdateDetailView(UpdateView):
    template_name = 'bill_of_entry/add.html'
    model = bill_of_entry.BillOfEntryModel
    form_class = forms.BillOfEntryForm

    def get_object(self, queryset=None):
        object = self.model.objects.get(id=self.kwargs.get('pk'))
        return object

    def get_success_url(self):
        boe = self.object.bill_of_entry_number
        return reverse('bill-of-entry-ajax-list') + '?bill_of_entry_number=' + str(boe)


class BillOfEntryUpdateView(UpdateWithInlinesView):
    template_name = 'bill_of_entry/add.html'
    model = bill_of_entry.BillOfEntryModel
    fields = ()
    inlines = [BillOfEntryLicenseImportItemInline, ]

    def get_success_url(self):
        boe = self.object.bill_of_entry_number
        return reverse('bill-of-entry-ajax-list') + '?bill_of_entry_number=' + str(boe)

    def dispatch(self, request, *args, **kwargs):
        # check if there is some video onsite
        license = self.get_object()
        return super(BillOfEntryUpdateView, self).dispatch(request, *args, **kwargs)

    def get_object(self, queryset=None):
        object = self.model.objects.get(id=self.kwargs.get('pk'))
        return object

    def get_inlines(self):
        allotments = self.object.allotment.all()
        for allotment in allotments:
            if allotment.allotment_details.all().exists():
                for allotment_item in allotment.allotment_details.all():
                    if not RowDetails.objects.filter(bill_of_entry=self.object,
                                                     sr_number=allotment_item.item).exists():
                        row, bool = RowDetails.objects.get_or_create(bill_of_entry=self.object,
                                                                     sr_number=allotment_item.item)
                        if not row.cif_inr or row.cif_inr == 0:
                            row.cif_inr = allotment_item.cif_inr
                        if not row.cif_fc or row.cif_fc == 0:
                            row.cif_fc = allotment_item.cif_fc
                        if not row.cif_inr or row.qty == 0:
                            row.qty = allotment_item.qty
                        row.save()
                    allotment_item.is_boe = True
                    allotment_item.save()
        self.inlines = [BillOfEntryLicenseImportItemInline, ]
        return super(BillOfEntryUpdateView, self).get_inlines()


class BillOfEntryFetchView(FormView):
    template_name = 'bill_of_entry/fetch.html'
    form_class = forms.BillOfEntryCaptcha

    def get_context_data(self, **kwargs):
        context = super(BillOfEntryFetchView, self).get_context_data(**kwargs)
        from bill_of_entry.scripts.boe import fetch_cookies
        cookies, csrftoken = fetch_cookies()
        from bill_of_entry.scripts.boe import fetch_captcha
        context['captcha_url'] = fetch_captcha(cookies)
        import json
        context['fetch_cookies'] = json.dumps(cookies)
        context['csrftoken'] = csrftoken
        data = self.kwargs.get('data')
        from bill_of_entry.models import BillOfEntryModel
        context['remain_count'] = BillOfEntryModel.objects.filter(
            Q(is_fetch=False) | Q(appraisement=None) | Q(ooc_date=None) | Q(ooc_date='N.A.')).exclude(
            failed__gte=5).count()
        context['remain_captcha'] = context['remain_count'] / 3
        return context

    def post(self, request, *args, **kwargs):
        captcha = self.request.POST.get('captcha')
        import json
        cookies = json.loads(self.request.POST.get('cookies'))
        csrftoken = self.request.POST.get('csrftoken')
        status = True
        from bill_of_entry.models import BillOfEntryModel
        data_list = BillOfEntryModel.objects.filter(
            Q(is_fetch=False) | Q(appraisement=None) | Q(ooc_date=None) | Q(ooc_date='N.A.')).exclude(
            failed__gte=5).order_by(
            '-bill_of_entry_date')
        for data in data_list:
            from bill_of_entry.scripts.utils import port_dict
            status = fetch_data_to_model.delay(cookies, csrftoken, port_dict, kwargs, captcha, data.pk)
        return HttpResponseRedirect(reverse('bill-of-entry-list'))


class BillOfEntryDeleteView(DeleteView):
    template_name = 'allotment/delete.html'
    model = bill_of_entry.BillOfEntryModel
    success_url = reverse_lazy('bill-of-entry-list')

    def get_object(self, queryset=None):
        object = self.model.objects.get(bill_of_entry_number=self.kwargs.get('boe'))
        return object


class DownloadPendingBillView(PDFTemplateResponseMixin, FilterView):
    table_class = tables.BillOfEntryTable
    filterset_class = filters.BillOfEntryFilter
    paginate_by = 500
    template_name = 'bill_of_entry/bill_export_pdf.html'
    model = bill_of_entry.BillOfEntryModel
    ordering = ('company', 'product_name', 'bill_of_entry_date')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        queryset = self.filterset_class(self.request.GET, queryset=self.get_queryset()).qs
        total_list = [Decimal(data.get_total_inr) for data in queryset]
        context['total_cif_fc'] = sum(total_list)
        import datetime
        context['today'] = datetime.datetime.now().date
        return context


class GenerateTransferLetterAPI(APIView):
    """
    POST /api/boe/<pk>/generate-transfer-letter/

    Body (JSON):
    {
      "company": "...",
      "company_address_line1": "...",
      "company_address_line2": "...",
      "tl_choice": 123,              # TransferLetterModel pk
      "modified_items": [            # must align with boe.item_details order
        {"cif_fc": 123.45},          # optional override; if null/absent, use item.cif_fc
        ...
      ]
    }
    """

    def post(self, request, pk):
        try:
            boe = BillOfEntryModel.objects.select_related().prefetch_related("item_details").get(id=pk)
        except BillOfEntryModel.DoesNotExist:
            return Response({"error": "BOE not found"}, status=status.HTTP_404_NOT_FOUND)

        company = request.data.get("company")
        address_1 = request.data.get("company_address_line1")
        address_2 = request.data.get("company_address_line2")
        tl_id = request.data.get("tl_choice")

        if not (company and address_1 and address_2 and tl_id):
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            transfer_letter = TransferLetterModel.objects.get(pk=tl_id)
        except TransferLetterModel.DoesNotExist:
            return Response({"error": "Transfer Letter not found"}, status=status.HTTP_404_NOT_FOUND)

        items_data = request.data.get("modified_items", [])
        boe_items = list(boe.item_details.all())

        # Optional sanity check: lengths should match to avoid silent truncation by zip()
        if items_data and len(items_data) != len(boe_items):
            return Response(
                {"error": "modified_items length does not match BOE item count"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today_str = now().date().isoformat()

        data = []
        for item, item_data in zip(boe_items, items_data or [{}] * len(boe_items)):
            override_fc = item_data.get("cif_fc", None)
            cif_fc = float(override_fc) if override_fc not in (None, "") else float(item.cif_fc or 0.0)

            lic = item.sr_number.license  # assuming relations exist
            # Handle possibly missing license_date on sr_number; fall back to license.license_issue_date if present
            try:
                license_date_dt = item.sr_number.license_date
            except AttributeError:
                license_date_dt = getattr(lic, "license_issue_date", None)
            license_date = license_date_dt.strftime("%d/%m/%Y") if license_date_dt else ""

            data.append({
                "status": getattr(lic, "purchase_status", "") or "",
                "company": company,
                "company_address_1": address_1,
                "company_address_2": address_2,
                "today": today_str,
                "license": lic.license_number,
                "license_date": license_date,
                "file_number": lic.file_number or "",
                "quantity": item.qty,
                "v_allotment_inr": round(float(item.cif_inr or 0.0), 2),
                "v_allotment_usd": cif_fc,
                "exporter_name": lic.exporter.name if getattr(lic, "exporter", None) else "",
                "boe": f"BE NUMBER :- {item.bill_of_entry.bill_of_entry_number}",
            })

        # Paths
        file_name_prefix = f"TL_{boe.bill_of_entry_number}_{transfer_letter.name.replace(' ', '_')}"
        # Store under MEDIA_ROOT
        output_dir = Path(settings.MEDIA_ROOT) / file_name_prefix
        output_dir.mkdir(parents=True, exist_ok=True)

        # Generate PDFs (or DOCX if converter missing)
        tl_path = transfer_letter.tl.path  # should be a real file path
        result = generate_tl_software(
            data=data,
            tl_path=tl_path,
            path=str(output_dir),
            transfer_letter_name=transfer_letter.name.replace(" ", "_"),
        )

        # Zip the folder
        base_name = str(output_dir)  # without .zip
        zip_file = make_archive(base_name, "zip", root_dir=str(output_dir))

        # Build URL from MEDIA_URL
        rel_zip_path = Path(zip_file).relative_to(settings.MEDIA_ROOT).as_posix()
        url = request.build_absolute_uri(f"{settings.MEDIA_URL}{rel_zip_path}")

        payload = {"url": url, "message": "Success"}
        if result.get("converter") is None:
            payload["warning"] = (
                "PDF converter not found; generated DOCX files instead. "
                "Install LibreOffice or set LIBREOFFICE_PATH to enable PDF output."
            )
        return Response(payload, status=status.HTTP_200_OK)


class BillOfEntryExportView(APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        export_type = request.headers.get('Accept', '')

        # Use only necessary fields with select_related and prefetch_related
        queryset = BillOfEntryFilter(
            request.GET,
            queryset=BillOfEntryModel.objects.select_related('company', 'port').prefetch_related(
                Prefetch(
                    'item_details',
                    queryset=RowDetails.objects.select_related(
                        'sr_number__license',
                        'sr_number__item'
                    ).only(
                        'id', 'qty', 'cif_fc', 'cif_inr', 'sr_number__license__license_number',
                        'sr_number__serial_number', 'sr_number__item__name'
                    )
                )
            )
        ).qs.only(
            'id', 'bill_of_entry_number', 'bill_of_entry_date',
            'invoice_no', 'product_name', 'exchange_rate',
            'company__name', 'port__code'
        )

        context = {
            'object_list': queryset.order_by('company'),
            'today': date.today(),
        }

        # Use optimized render_to_pdf
        response = render_to_pdf('bill_of_entry/bill_export_pdf.html', context)
        response['Content-Disposition'] = 'attachment; filename="bill_of_entries.pdf"'
        response['Content-Type'] = 'application/pdf'
        return response


class ExportBOEExcelView(APIView):
    def get(self, request, *args, **kwargs):
        queryset = BillOfEntryFilter(
            request.GET,
            queryset=BillOfEntryModel.objects.prefetch_related(
                'item_details__sr_number__license',
                'company',
                'port'
            )
        ).qs

        wb = Workbook()
        ws = wb.active
        ws.title = "Pending BOE"
        ws.append(["Pending Bills", "", "", "", date.today()])

        bold_font = Font(bold=True)
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )

        def apply_border_and_font(row_idx, col_count, font=None):
            for col in range(1, col_count + 1):
                cell = ws.cell(row=row_idx, column=col)
                cell.border = thin_border
                if font:
                    cell.font = font

        companies = {}
        for boe in queryset:
            companies.setdefault(boe.company.name, []).append(boe)

        for company_name, boes in companies.items():
            ws.append([company_name])
            company_row = ws.max_row
            ws.cell(row=company_row, column=1).font = bold_font

            product_groups = {}
            for boe in boes:
                product_groups.setdefault(boe.product_name or '-', []).append(boe)

            for product_name, items in product_groups.items():
                ws.append([
                    "Sr No", "BE No.", "BE Dt.", "Port", "Qty", "Unit Price", "Value ($)",
                    "Exc Rt.", "Value (INR)", "Item Name", "Invoice",
                    "DFIA No.", "DFIA Sr No.", "DFIA Qty", "DFIA $", "DFIA INR"
                ])
                header_row = ws.max_row
                apply_border_and_font(header_row, 16, bold_font)

                start_row = ws.max_row + 1

                for idx, boe in enumerate(items, start=1):
                    license_rows = []
                    for detail in boe.item_details.all():
                        license_rows.append([
                            detail.sr_number.license.license_number,  # DFIA No
                            detail.sr_number.serial_number,  # DFIA Sr No
                            detail.qty,
                            detail.cif_fc,
                            detail.cif_inr,
                            detail.sr_number.license.purchase_status
                        ])

                    total_qty = boe.get_total_quantity
                    total_fc = boe.get_total_fc
                    total_inr = boe.get_total_inr
                    invoice = boe.invoice_no or '-'
                    item_name = boe.product_name or (
                        boe.item_details.first().sr_number.item.name if boe.item_details.exists() else '-'
                    )

                    ws.append([
                        idx,
                        boe.bill_of_entry_number,
                        str(boe.bill_of_entry_date),
                        boe.port.code if boe.port else '-',
                        total_qty,
                        boe.get_unit_price,
                        total_fc,
                        boe.get_exchange_rate,
                        total_inr,
                        item_name,
                        invoice,
                        "", "", "", "", ""
                    ])
                    main_row = ws.max_row
                    apply_border_and_font(main_row, 16)

                    for lic_row in license_rows:
                        ws.append(["", "", "", "", "", "", "", "", "", "", "", *lic_row])
                        lic_row_row = ws.max_row
                        apply_border_and_font(lic_row_row, 16)

                end_row = ws.max_row
                ws.append([
                    "-", "-", "-", "Total",
                    f"=SUM(E{start_row}:E{end_row})",  # Qty
                    "-",
                    f"=SUM(G{start_row}:G{end_row})",  # Value ($)
                    "-",
                    f"=SUM(I{start_row}:I{end_row})",  # Value (INR)
                    "", "", "", "",
                    f"=SUM(M{start_row}:N{end_row})",  # DFIA Qty
                    f"=SUM(N{start_row}:O{end_row})",  # DFIA $
                    f"=SUM(O{start_row}:P{end_row})"  # DFIA INR
                ])
                total_row = ws.max_row
                apply_border_and_font(total_row, 16, bold_font)
                ws.append([])

        # Auto-fit columns
        for col in ws.columns:
            max_length = 0
            column = col[0].column
            column_letter = get_column_letter(column)
            for cell in col:
                try:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                except:
                    pass
            adjusted_width = max_length + 2
            ws.column_dimensions[column_letter].width = adjusted_width

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=bill_of_entries.xlsx'
        wb.save(response)
        return response
