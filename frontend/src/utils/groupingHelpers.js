// src/utils/groupingHelpers.js
// Reusable label pickers + totalizers for different modules.

export const getLicenseNormLabel = (e) => {
    const arr = Array.isArray(e?.export_license) ? e.export_license : [];
    const first = arr.find((x) => x?.norm_class?.norm_class);
    return (
        first?.norm_class?.norm_class ||
        (typeof e?.norm_class === "string" ? e.norm_class : null) ||
        "— Norm —"
    );
};

export const licenseEntryTotals = (entry) => {
    const arr = Array.isArray(entry?.export_license) ? entry.export_license : [];
    return arr.reduce(
        (acc, x) => ({
            fc: acc.fc + (Number(x?.cif_fc) || 0),
            inr: acc.inr + (Number(x?.cif_inr) || 0),
        }),
        {fc: 0, inr: 0}
    );
};
export const licenseTotals = (entries = []) =>
    entries.reduce(
        (acc, e) => {
            const t = licenseEntryTotals(e);
            acc.fc += t.fc;
            acc.inr += t.inr;
            return acc;
        },
        {fc: 0, inr: 0}
    );

// For Allotments & BOE: treat middle level as “Item”
export const getItemLabel = (e) =>
    e?.product_name ??
    e?.item_name ??
    e?.item?.name ??
    e?.hs_code?.hs_code ??
    e?.hs_code ??
    "— Item —";

// Allotments totals from allotment_details lines
export const allotmentEntryTotals = (entry) => {
    const lines = Array.isArray(entry?.allotment_details) ? entry.allotment_details : [];
    return lines.reduce(
        (acc, l) => {
            acc.qty += Number(l?.qty) || 0;
            acc.fc += Number(l?.cif_fc) || 0;
            acc.inr += Number(l?.cif_inr) || 0;
            return acc;
        },
        {qty: 0, fc: 0, inr: 0}
    );
};
export const allotmentTotals = (entries = []) =>
    entries.reduce(
        (acc, e) => {
            const t = allotmentEntryTotals(e);
            acc.qty += t.qty;
            acc.fc += t.fc;
            acc.inr += t.inr;
            return acc;
        },
        {qty: 0, fc: 0, inr: 0}
    );

// BOE (robust): take entry-level cif/values or sum lines if needed
export const boeEntryTotals = (entry) => {
    let fc =
        Number(entry?.cif_fc ?? entry?.value_fc ?? entry?.cif_value ?? 0) || 0;
    let inr =
        Number(entry?.cif_inr ?? entry?.value_inr ?? entry?.assessable_value_inr ?? 0) || 0;

    const lines = entry?.boe_items || entry?.items || [];
    if ((fc === 0 && inr === 0) && Array.isArray(lines)) {
        for (const l of lines) {
            fc += Number(l?.cif_fc ?? l?.value_fc ?? 0) || 0;
            inr += Number(l?.cif_inr ?? l?.value_inr ?? 0) || 0;
        }
    }
    return {fc, inr};
};
export const boeTotals = (entries = []) =>
    entries.reduce(
        (acc, e) => {
            const t = boeEntryTotals(e);
            acc.fc += t.fc;
            acc.inr += t.inr;
            return acc;
        },
        {fc: 0, inr: 0}
    );
