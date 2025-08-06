import re

from django import template

register = template.Library()


@register.filter
def clean_cents(value):
    if not isinstance(value, str):
        return value
    # Remove variations like ", zero cents" or ", zero paise"
    return re.sub(r",\s*zero\s+(cents|paise)", "", value, flags=re.IGNORECASE).upper()
