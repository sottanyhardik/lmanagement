from django.db import migrations


def assign_items_to_import_rows(apps, schema_editor):
    LicenseImportItemsModel = apps.get_model('license', 'LicenseImportItemsModel')
    ItemNameModel = apps.get_model('core', 'ItemNameModel')

    # Define your filter_list() logic directly here
    from setup.migrations_script import filter_list
    items_and_filters = filter_list()

    for item_name, query_filter in items_and_filters:
        try:
            nItem = ItemNameModel.objects.get(name=item_name)

            matching_items = LicenseImportItemsModel.objects.filter(query_filter)

            for import_item in matching_items:
                import_item.items.add(nItem)

        except ItemNameModel.DoesNotExist:
            continue


class Migration(migrations.Migration):
    dependencies = [
        ('license', '0033_remove_licenseimportitemsmodel_license_lic_item_id_c3fee2_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(assign_items_to_import_rows, reverse_code=migrations.RunPython.noop),
    ]
