// src/utils/groupEntries.js
/**
 * Group BOE-like entries into:
 *   company -> item -> port -> entries (+summaries)
 *
 * Handles APIs that return either nested objects (e.g. {company: {id, name}})
 * OR plain IDs/strings (e.g. company: 2) by checking multiple fallbacks.
 */
export const groupEntries = (entries = [], opts = {}) => {
    const {
        // Optional: { [id]: "Company Name" } map if your API returns only IDs
        companyLookup = null,

        getCompany = (e) => {
            // prefer nested obj names
            const fromObj =
                e?.company?.name ??
                e?.company?.display_name ??
                e?.company?.label ??
                null;

            // common flat fields sent by serializers
            const fromFlat =
                e?.company_name ??
                e?.company_label ??
                null;

            // if only an id/string is present, try lookup map or stringify
            const raw = e?.company;
            const fromLookup =
                (companyLookup && (companyLookup[raw?.id] || companyLookup[raw])) ||
                null;

            return (
                fromObj ??
                fromFlat ??
                fromLookup ??
                (typeof raw === 'string' ? raw : null) ??
                (typeof raw === 'number' ? String(raw) : null) ??
                'Unknown Company'
            );
        },

        getItem = (e) =>
            e?.item_name ??
            e?.item?.name ??
            e?.product?.name ??
            e?.product_name ??
            'Unknown Item',

        getPort = (e) => {
            const p = e?.port;
            return (
                p?.name ??
                p?.code ??
                e?.port_name ??
                e?.port_code ??
                (typeof p === 'string' ? p : null) ??
                (typeof p === 'number' ? String(p) : null) ??
                'Unknown Port'
            );
        },

        getQty = (e) =>
            Number(e?.get_total_quantity ?? e?.quantity ?? 0),

        getFc = (e) =>
            Number(e?.get_total_fc ?? e?.cif_fc ?? 0),

        getInr = (e) =>
            Number(e?.get_total_inr ?? e?.cif_inr ?? 0),
    } = opts;

    const groups = {};
    const add = (s, q, f, i) => {
        s.qty += Number.isFinite(q) ? q : 0;
        s.fc += Number.isFinite(f) ? f : 0;
        s.inr += Number.isFinite(i) ? i : 0;
    };

    for (const entry of entries || []) {
        const companyName = String(getCompany(entry) || 'Unknown Company').trim();
        const itemName = String(getItem(entry) || 'Unknown Item').trim();
        const portLabel = String(getPort(entry) || 'Unknown Port').trim();

        const qty = getQty(entry) || 0;
        const fc = getFc(entry) || 0;
        const inr = getInr(entry) || 0;

        if (!groups[companyName]) {
            groups[companyName] = {
                items: {},
                totalSummary: {qty: 0, fc: 0, inr: 0},
            };
        }
        if (!groups[companyName].items[itemName]) {
            groups[companyName].items[itemName] = {
                ports: {},
                summary: {qty: 0, fc: 0, inr: 0},
            };
        }
        if (!groups[companyName].items[itemName].ports[portLabel]) {
            groups[companyName].items[itemName].ports[portLabel] = {
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0},
            };
        }

        const portBucket = groups[companyName].items[itemName].ports[portLabel];
        portBucket.entries.push(entry);
        add(portBucket.summary, qty, fc, inr);
        add(groups[companyName].items[itemName].summary, qty, fc, inr);
        add(groups[companyName].totalSummary, qty, fc, inr);
    }

    return groups;
};
