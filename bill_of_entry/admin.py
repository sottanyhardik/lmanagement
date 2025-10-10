from django.contrib import admin
from django.apps import apps
from django.utils.text import capfirst

from .models import BillOfEntryModel, RowDetails

# Explicit ModelAdmin for BillOfEntryModel
@admin.register(BillOfEntryModel)
class BillOfEntryAdmin(admin.ModelAdmin):
    list_display = ('bill_of_entry_number', 'bill_of_entry_date', 'port', 'company', 'invoice_no', 'get_total_inr', 'get_total_fc')
    list_filter = ('port', 'company', 'bill_of_entry_date')
    # allow searching by bill_of_entry_number (direct) and related RowDetails license number
    search_fields = (
        'bill_of_entry_number',
        'item_details__sr_number__license__license_number',  # <-- enables search by RowDetails license number
        'company__name',
        'invoice_no',
    )
    readonly_fields = ('get_total_inr', 'get_total_fc')
    ordering = ('-bill_of_entry_date',)

    def get_total_inr(self, obj):
        return obj.get_total_inr
    get_total_inr.short_description = 'Total INR'

    def get_total_fc(self, obj):
        return obj.get_total_fc
    get_total_fc.short_description = 'Total FC'


@admin.register(RowDetails)
class RowDetailsAdmin(admin.ModelAdmin):
    list_display = ('sr_number', 'bill_of_entry', 'transaction_type', 'cif_inr', 'cif_fc', 'qty')
    search_fields = ('sr_number__license__license_number', 'bill_of_entry__bill_of_entry_number')
    list_filter = ('transaction_type',)


# Register remaining models dynamically (but skip those already registered above)
app = apps.get_app_config('bill_of_entry')
for model_name, model in app.models.items():
    if model in (BillOfEntryModel, RowDetails):
        continue
    # if already registered skip
    if admin.site.is_registered(model):
        continue
    # build a safe ModelAdmin with sensible defaults
    list_display = getattr(model, 'admin_list_display', None)
    if not list_display:
        # default to first few fields
        list_display = tuple(field.name for field in model._meta.fields)[:6]
    model_admin = type(f"{model_name}Admin", (admin.ModelAdmin,), {
        'list_display': list_display,
        'list_display_links': getattr(model, 'admin_list_display_links', ()),
        'list_editable': getattr(model, 'admin_list_editable', ()),
        'search_fields': tuple(getattr(model, 'admin_search_fields', ())),
        'list_filter': getattr(model, 'list_filter', ()),
    })
    try:
        admin.site.register(model, model_admin)
    except admin.sites.AlreadyRegistered:
        # skip already registered models
        pass
