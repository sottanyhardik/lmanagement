from django import template

register = template.Library()


@register.filter
def indian_format(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return value

    # Indian comma formatting logic
    import locale
    locale.setlocale(locale.LC_ALL, 'en_IN')
    formatted = locale.format_string("%.2f", value, grouping=True)
    return formatted
