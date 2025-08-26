from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

from django import template

register = template.Library()


def _format_indian(value, places=2):
    # Convert to Decimal and round
    d = Decimal(str(value))
    q = Decimal(10) ** -places
    d = d.quantize(q, rounding=ROUND_HALF_UP)

    sign = "-" if d < 0 else ""
    s = f"{abs(d):f}"

    if "." in s:
        int_part, frac = s.split(".")
    else:
        int_part, frac = s, ""

    # Indian grouping: last 3 digits, then groups of 2
    if len(int_part) > 3:
        last3 = int_part[-3:]
        rest = int_part[:-3]
        pairs = []
        while rest:
            pairs.append(rest[-2:])
            rest = rest[:-2]
        int_part = ",".join(reversed(pairs)) + "," + last3

    if places > 0:
        frac = (frac + "0" * places)[:places]
        return f"{sign}{int_part}.{frac}"
    return f"{sign}{int_part}"


@register.filter
def indian_format(value, places=2):
    if value in (None, ""):
        return ""
    try:
        return _format_indian(value, int(places))
    except (InvalidOperation, ValueError, TypeError):
        return value
