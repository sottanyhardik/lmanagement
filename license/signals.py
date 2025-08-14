# license/signals.py
from django.db.models import Count
from django.db.models.signals import post_save
from django.dispatch import receiver

from bill_of_entry.tasks import update_balance_values_task
from core.models import ItemNameModel
from setup.migrations_script import filter_list  # existing util that returns [(name, Q(...)), ...]
from .models import LicenseImportItemsModel


@receiver(post_save, sender=LicenseImportItemsModel)
def update_balance_and_autotag(sender, instance, **kwargs):
    # async update (your existing task)
    update_balance_values_task(instance.id)

    # auto-tag empty "items" via your filter_list rules
    for item_name, q in filter_list():
        try:
            n_item = ItemNameModel.objects.get(name=item_name)
        except ItemNameModel.DoesNotExist:
            continue

        (LicenseImportItemsModel.objects
         .filter(license=instance.license)
         .filter(q)
         .annotate(item_count=Count("items"))
         .filter(item_count=0)
         .update())  # we add m2m below

        for row in (LicenseImportItemsModel.objects
                .filter(license=instance.license)
                .filter(q)
                .annotate(item_count=Count("items"))
                .filter(item_count=0)):
            row.items.add(n_item)
