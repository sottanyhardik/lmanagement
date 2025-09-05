export const sum = (arr, f) => (arr || []).reduce((a, x) => a + Number(x?.[f] || 0), 0);

export const computeTotals = (arr = []) => ({
    qty: +sum(arr, "qty").toFixed(2),
    cif_fc: +sum(arr, "cif_fc").toFixed(2),
    cif_inr: +sum(arr, "cif_inr").toFixed(2),
    fob_inr: +sum(arr, "fob_inr").toFixed(2),
    amount: +sum(arr, "amount").toFixed(2),
});

// seed item-wise rows (HSN intentionally excluded)
export const makeItemWiseDefaults = (entry) => {
    const src = entry?.import_license || [];
    return src.map((d) => ({
        sr_id: d.id,
        license_no: entry?.license_number || "",
        qty: Number(d.quantity || 0),
        cif_fc: Number(d.cif_fc || 0),
        cif_inr: Number(d.cif_inr || 0),
        fob_inr: Number(d.fob_inr || 0),
        rate: 0,
        amount: 0,
    }));
};

// seed a single full-license row (attach first import line id for FK safety)
export const makeFullLicenseRow = (entry) => {
    const src = entry?.import_license || [];
    const firstId = src[0]?.id ?? null;
    return [
        {
            sr_id: firstId,
            license_no: entry?.license_number || "",
            qty: Number(sum(src, "quantity") || 0),
            cif_fc: Number(sum(src, "cif_fc") || 0),
            cif_inr: Number(sum(src, "cif_inr") || 0),
            fob_inr: Number(sum(src, "fob_inr") || 0),
            rate: 0,
            amount: 0,
            _full_license: true,
        },
    ];
};

// amount calc for one row
export const recalcRowAmount = (row, {saleType, billingMode, saleBasis}) => {
    const rate = Number(row?.rate || 0);
    if (saleType === "full") {
        const base = saleBasis === "fob_inr" ? Number(row.fob_inr || 0) : Number(row.cif_inr || 0);
        return (base * rate) / 100;
    }
    // item-wise
    if (billingMode === "kg") return Number(row.qty || 0) * rate;
    return (Number(row.cif_inr || 0) * rate) / 100; // cif_inr %
};
