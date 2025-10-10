export const emptyTrade = {
    direction: "PURCHASE",
    invoice_number: "",
    invoice_date: "",
    remarks: "",

    from_company: null,
    to_company: null,
    boe: null,

    from_pan: "",
    from_gst: "",
    from_addr_line_1: "",
    from_addr_line_2: "",
    to_pan: "",
    to_gst: "",
    to_addr_line_1: "",
    to_addr_line_2: "",

    lines: [],
    payments: [],
};

export const asId = (opt) => opt?.id ?? opt?.value ?? null;
export const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
