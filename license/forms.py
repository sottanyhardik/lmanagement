from django import forms

from core import models as core_model, custom_widgets
from . import models as license_model


class BaseStyledForm(forms.ModelForm):
    """
    Base form that:
      • sets HTML5 date inputs for *date* fields
      • adds 'form-control' to all widgets
      • sets textarea rows to 1 by default
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            # HTML5 date input for any field containing 'date' in its name
            if 'date' in name:
                field.widget.input_type = 'date'

            # Add bootstrap class safely
            existing = field.widget.attrs.get('class', '')
            field.widget.attrs['class'] = (existing + ' form-control').strip()

            # Compact textareas
            if isinstance(field.widget, forms.Textarea):
                field.widget.attrs.setdefault('rows', '1')


class ExportItemsForm(BaseStyledForm):
    # Declared with .none() to satisfy type-checkers at class level; set real queryset in __init__
    norm_class = forms.ModelChoiceField(
        queryset=core_model.SionNormClassModel.objects.none(),
        widget=custom_widgets.NormWidget,
        required=False,
    )
    item = forms.ModelChoiceField(
        queryset=core_model.ItemNameModel.objects.none(),
        widget=custom_widgets.ItemWidget,
        required=False,
    )

    class Meta:
        model = license_model.LicenseExportItemModel
        fields = [
            'item', 'norm_class', 'duty_type', 'net_quantity', 'old_quantity', 'unit',
            'fob_fc', 'fob_inr', 'currency', 'fob_exchange_rate', 'value_addition',
            'cif_fc', 'cif_inr',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Real querysets (runtime, DB-aware)
        self.fields['norm_class'].queryset = core_model.SionNormClassModel.objects.all()
        self.fields['item'].queryset = core_model.ItemNameModel.objects.all()


class ImportItemsForm(BaseStyledForm):
    hs_code = forms.ModelChoiceField(
        queryset=core_model.HSCodeModel.objects.none(),
        widget=custom_widgets.HSCodeSingleWidget,
        required=False,
    )
    items = forms.ModelChoiceField(
        queryset=core_model.ItemNameModel.objects.none(),
        widget=custom_widgets.ItemWidget,
        required=False,
    )

    class Meta:
        model = license_model.LicenseImportItemsModel
        fields = [
            'serial_number', 'hs_code', 'items', 'description', 'quantity', 'old_quantity',
            'cif_fc', 'comment', 'is_restrict',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Real querysets
        self.fields['hs_code'].queryset = core_model.HSCodeModel.objects.all()
        self.fields['items'].queryset = core_model.ItemNameModel.objects.all()

        # Extra CSS classes like your original
        for name, field in self.fields.items():
            if 'serial_number' in name:
                field.widget.attrs['class'] += ' span1'
            if any(k in name for k in ['hs_code', 'quantity', 'unit']):
                field.widget.attrs['class'] += ' span2'


class LicenseDetailsForm(BaseStyledForm):
    port = forms.ModelChoiceField(
        queryset=core_model.PortModel.objects.none(),
        widget=custom_widgets.PortWidget,
        required=False,
    )
    exporter = forms.ModelChoiceField(
        queryset=core_model.CompanyModel.objects.none(),
        widget=custom_widgets.CompanyWidget,
        required=False,
    )

    class Meta:
        model = license_model.LicenseDetailsModel
        fields = [
            'scheme_code', 'notification_number', 'license_number', 'license_date',
            'license_expiry_date', 'file_number', 'exporter', 'port',
            'registration_number', 'registration_date', 'user_restrictions', 'user_comment',
            'purchase_status', 'is_au', 'is_not_registered', 'user_comment',
            'ge_file_number', 'is_mnm', 'condition_sheet',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['port'].queryset = core_model.PortModel.objects.all()
        self.fields['exporter'].queryset = core_model.CompanyModel.objects.all()


class LicenseDocumentForm(BaseStyledForm):
    class Meta:
        model = license_model.LicenseDocumentModel
        fields = ['license', 'type', 'file']


class LicenseInwardOutwardForm(BaseStyledForm):
    license = forms.ModelChoiceField(
        queryset=license_model.LicenseDetailsModel.objects.none(),
        widget=custom_widgets.LicenseWidget,
        required=False,
    )
    copy = forms.BooleanField(initial=True, required=False)
    tl = forms.BooleanField(initial=True, required=False)
    status = forms.ModelChoiceField(
        queryset=license_model.StatusModel.objects.none(),
        required=True,
        initial=3,  # ensure PK 3 exists
    )
    office = forms.ModelChoiceField(
        queryset=license_model.OfficeModel.objects.none(),
        required=True,
        initial=1,  # ensure PK 1 exists
    )

    class Meta:
        model = license_model.LicenseInwardOutwardModel
        fields = [
            'date', 'license', 'status', 'office', 'description',
            'amd_sheets_number', 'copy', 'annexure', 'tl',
            'aro', 'along_with',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['license'].queryset = license_model.LicenseDetailsModel.objects.all()
        self.fields['status'].queryset = license_model.StatusModel.objects.all()
        self.fields['office'].queryset = license_model.OfficeModel.objects.all()
