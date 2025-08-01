from decimal import Decimal, DivisionByZero

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.urls import reverse
from django.utils.functional import cached_property

from core.models import AuditModel, InvoiceEntity, CompanyModel

Credit = 'C'
Debit = 'D'
TYPE_CHOICES = (
    (Credit, 'Credit'),
    (Debit, 'Debit')
)

ARO = 'AR'
ALLOTMENT = 'AT'
ROW_TYPE = (
    (ARO, 'ARO'),
    (ALLOTMENT, 'Allotment')
)


class BillOfEntryModel(AuditModel):
    company = models.ForeignKey(
        'core.CompanyModel', related_name="bill_of_entry", on_delete=models.CASCADE,
        null=True, blank=True
    )
    bill_of_entry_number = models.CharField(max_length=25)
    bill_of_entry_date = models.DateField(null=True, blank=True)
    port = models.ForeignKey(
        'core.PortModel', on_delete=models.CASCADE, related_name='boe_port',
        null=True, blank=True
    )
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal('0.0000'))
    product_name = models.CharField(max_length=255, default='')
    allotment = models.ManyToManyField('allotment.AllotmentModel', related_name="bill_of_entry", blank=True)
    invoice_no = models.CharField(max_length=255, null=True, blank=True)
    invoice_date = models.DateField(null=True, blank=True)
    is_fetch = models.BooleanField(default=False)
    failed = models.IntegerField(default=0)
    appraisement = models.CharField(max_length=255, null=True, blank=True)
    ooc_date = models.CharField(max_length=255, null=True, blank=True)
    cha = models.CharField(max_length=255, null=True, blank=True)
    comments = models.TextField(null=True, blank=True)

    admin_search_fields = ['bill_of_entry_number']

    class Meta:
        unique_together = ('bill_of_entry_number', 'bill_of_entry_date', 'port')
        ordering = ('-bill_of_entry_date',)
        verbose_name = "Bill of Entry"
        verbose_name_plural = "Bills of Entry"

    def save(self, *args, **kwargs):
        # Only calculate exchange rate if it's not explicitly set or is 0
        if not self.exchange_rate or self.exchange_rate == Decimal('0.0000'):
            try:
                total_fc = self.get_total_fc
                total_inr = self.get_total_inr
                if total_fc > 0:
                    calculated_rate = round(total_inr / total_fc, 4)
                    self.exchange_rate = calculated_rate
            except (ZeroDivisionError, DivisionByZero, TypeError):
                self.exchange_rate = Decimal('0.0000')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.bill_of_entry_number

    @cached_property
    def get_absolute_url(self):
        return reverse('bill-of-entry-detail', kwargs={'boe': self.bill_of_entry_number})

    @cached_property
    def item_details_cached(self):
        return self.item_details.all()

    @cached_property
    def get_total_inr(self):
        total = self.item_details_cached.aggregate(Sum('cif_inr'))['cif_inr__sum']
        return round(total or 0, 2)

    @cached_property
    def get_total_fc(self):
        total = self.item_details_cached.aggregate(Sum('cif_fc'))['cif_fc__sum']
        return round(total or 0, 2)

    @cached_property
    def get_total_quantity(self):
        total = self.item_details_cached.aggregate(Sum('qty'))['qty__sum']
        return round(total or 0, 2)

    @cached_property
    def get_licenses(self):
        return ", ".join([
            item.sr_number.license.license_number
            for item in self.item_details_cached
            if item.sr_number.license
        ])

    @cached_property
    def get_unit_price(self):
        total_qty = self.get_total_quantity
        if total_qty > 0:
            return round(self.get_total_fc / total_qty, 3)
        return 0

    @cached_property
    def get_exchange_rate(self):
        total_fc = self.get_total_fc
        if total_fc > 0:
            return round(self.get_total_inr / total_fc, 3)
        return 0


class RowDetails(AuditModel):
    bill_of_entry = models.ForeignKey(
        BillOfEntryModel, on_delete=models.CASCADE,
        related_name='item_details', null=True, blank=True
    )
    row_type = models.CharField(max_length=2, choices=ROW_TYPE, default=ALLOTMENT)
    sr_number = models.ForeignKey(
        'license.LicenseImportItemsModel', on_delete=models.CASCADE,
        related_name='item_details'
    )
    transaction_type = models.CharField(max_length=2, choices=TYPE_CHOICES, default=Debit)
    cif_inr = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                  validators=[MinValueValidator(Decimal('0.00'))])
    cif_fc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                 validators=[MinValueValidator(Decimal('0.00'))])
    qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0.000'),
                              validators=[MinValueValidator(Decimal('0.000'))])

    admin_search_fields = ('sr_number__license__license_number', 'bill_of_entry__bill_of_entry_number')

    class Meta:
        ordering = ['transaction_type', 'bill_of_entry__bill_of_entry_date']
        unique_together = ('bill_of_entry', 'sr_number', 'transaction_type')
        verbose_name = "Item Detail"
        verbose_name_plural = "Item Details"

    def __str__(self):
        return str(self.sr_number)


# Signal handlers for stock update
@receiver(post_save, sender=RowDetails, dispatch_uid="update_stock_on_save")
def update_stock(sender, instance, **kwargs):
    item = instance.sr_number
    from bill_of_entry.tasks import update_balance_values_task
    update_balance_values_task(item.id)


@receiver(post_delete, sender=RowDetails, dispatch_uid="update_stock_on_delete")
def delete_stock(sender, instance, *args, **kwargs):
    item = instance.sr_number
    from bill_of_entry.tasks import update_balance_values_task
    update_balance_values_task(item.id)


class Invoice(models.Model):
    bills_of_entry = models.ForeignKey('bill_of_entry.BillOfEntryModel', related_name='invoices', blank=True,
                                       null=True, on_delete=models.CASCADE)
    from_entity = models.ForeignKey(InvoiceEntity, on_delete=models.CASCADE)
    to_company_name = models.CharField(max_length=255)
    to_company_pan = models.CharField(max_length=20)
    to_company_gst = models.CharField(max_length=20)
    to_company_address_line_1 = models.TextField()
    to_company_address_line_2 = models.TextField(blank=True)
    invoice_number = models.CharField(max_length=50, unique=True)
    invoice_date = models.DateField(auto_now_add=True)
    billing_mode = models.CharField(max_length=10, choices=[('kg', 'KG'), ('cif', 'CIF')])
    total_qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    total_cif = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, related_name='items', on_delete=models.CASCADE)
    sr_number = models.ForeignKey(
        'license.LicenseImportItemsModel',
        on_delete=models.CASCADE,
        related_name='invoice_items'
    )
    license_no = models.CharField(max_length=50)  # for quick display, filled from sr_number.license.license_number
    hsn_code = models.CharField(max_length=10, default='490700')
    qty = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    cif_fc = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    cif_inr = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=15, decimal_places=2)

    def save(self, *args, **kwargs):
        # Auto-fill license_no from sr_number on save
        if self.sr_number and not self.license_no:
            self.license_no = self.sr_number.license.license_number
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.license_no} - {self.amount}"
