const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z{1}[0-9A-Z]{1}$/;

export function validateInvoiceForm({toCompany = {}, entity = {}, items = []}) {
    const errors = {};
    const pan = toCompany?.pan?.trim().toUpperCase() || "";
    const gst = toCompany?.gst_number?.trim().toUpperCase() || "";

    if (!toCompany?.name) errors.to_company_name = "Company name is required.";
    if (!pan) errors.to_company_pan = "PAN number is required.";
    else if (!PAN_REGEX.test(pan)) errors.to_company_pan = "Invalid PAN format.";

    if (!gst) errors.to_company_gst = "GST number is required.";
    else if (!GST_REGEX.test(gst)) errors.to_company_gst = "Invalid GST format.";

    if (!entity?.id) errors.from_entity = "From Company is required.";

    (items || []).forEach((it, idx) => {
        if (!it.rate || isNaN(it.rate)) errors[`item_${idx}_rate`] = "Valid rate is required.";
    });

    return errors;
}
