// src/utils/groupEntries.js
/**
 * Generic grouping:
 *  - levels: 3 (default) => company -> item -> port -> entries (+summaries)
 *  - levels: 2           => company -> port -> entries (+summaries)
 *
 * If you provide a `sort` object, arrays are returned (companies/items/ports).
 * If no sorting is provided, maps (plain objects) are returned for performance.
 */
export const groupEntries = (entries = [], opts = {}) => {
    const {
        // MODE
        levels = 3, // 3 | 2

        // Optional lookup if API returns only IDs
        companyLookup = null,

        // ---- Accessors (strings/ids) ----
        getCompany = (e) => {
            const fromObj =
                e?.company?.name ??
                e?.company?.display_name ??
                e?.company?.label ??
                null;
            const fromFlat = e?.company_name ?? e?.company_label ?? null;
            const raw = e?.company;
            const fromLookup =
                (companyLookup && (companyLookup[raw?.id] || companyLookup[raw])) || null;
            return (
                fromObj ??
                fromFlat ??
                fromLookup ??
                (typeof raw === "string" ? raw : null) ??
                (typeof raw === "number" ? String(raw) : null)
            );
        },
        getCompanyId = (e) =>
            e?.company?.id ??
            e?.company_id ??
            (typeof e?.company === "number" ? e.company : null),

        // Only used when levels === 3
        getItem = (e) =>
            e?.item_name ??
            e?.item?.name ??
            e?.product?.name ??
            e?.product_name ??
            null,
        getItemId = (e) => e?.item?.id ?? e?.item_id ?? null,

        // Port
        getPort = (e) => {
            const p = e?.port;
            return (
                p?.name ??
                p?.code ??
                e?.port_name ??
                e?.port_code ??
                (typeof p === "string" ? p : null) ??
                (typeof p === "number" ? String(p) : null)
            );
        },
        getPortId = (e) =>
            e?.port?.id ??
            e?.port_id ??
            (typeof e?.port === "number" ? e.port : null),

        // ---- Numeric accessors (for summaries) ----
        getQty = (e) =>
            Number(e?.get_total_quantity ?? e?.quantity ?? e?.required_quantity ?? 0),
        getFc = (e) => Number(e?.get_total_fc ?? e?.cif_fc ?? 0),
        getInr = (e) => Number(e?.get_total_inr ?? e?.cif_inr ?? 0),

        // ---- Formatting/behavior ----
        normalize = {}, // { company?: fn, item?: fn, port?: fn } -> return label string
        round = null,   // (n) => n
        // When levels=3: {companies?, items?, ports?}
        // When levels=2: {companies?, ports?}
        sort = null,
        unknowns = {
            company: "Unknown Company",
            item: "Unknown Item",
            port: "Unknown Port",
        },
    } = opts;

    const normalizeLabel = (fn, v, fallback) => {
        const s = (v ?? "").toString().trim();
        return fn ? (fn(s) || fallback) : (s || fallback);
    };
    const num = (v) => (v == null ? 0 : Number(v)) || 0;
    const applyRound = (n) => (round ? round(n) : n);

    const add = (s, q, f, i) => {
        s.qty = applyRound((s.qty ?? 0) + num(q));
        s.fc = applyRound((s.fc ?? 0) + num(f));
        s.inr = applyRound((s.inr ?? 0) + num(i));
    };

    const companies = {};

    for (const entry of entries || []) {
        const cLabel = normalizeLabel(normalize.company, getCompany(entry), unknowns.company);
        const cId = getCompanyId(entry) ?? null;
        const pLabel = normalizeLabel(normalize.port, getPort(entry), unknowns.port);
        const pId = getPortId(entry) ?? null;

        const qty = getQty(entry) || 0;
        const fc = getFc(entry) || 0;
        const inr = getInr(entry) || 0;

        // ensure company bucket
        if (!companies[cLabel]) {
            companies[cLabel] = {
                id: cId,
                totalSummary: {qty: 0, fc: 0, inr: 0},
                ...(levels === 3 ? {items: {}} : {ports: {}}),
            };
        }
        const cNode = companies[cLabel];

        if (levels === 2) {
            // company -> port -> entries
            if (!cNode.ports[pLabel]) {
                cNode.ports[pLabel] = {id: pId, entries: [], summary: {qty: 0, fc: 0, inr: 0}};
            }
            const pNode = cNode.ports[pLabel];

            pNode.entries.push(entry);
            add(pNode.summary, qty, fc, inr);
            add(cNode.totalSummary, qty, fc, inr);
        } else {
            // levels === 3: company -> item -> port -> entries
            const iLabel = normalizeLabel(normalize.item, getItem(entry), unknowns.item);
            const iId = getItemId(entry) ?? null;

            if (!cNode.items[iLabel]) {
                cNode.items[iLabel] = {id: iId, ports: {}, summary: {qty: 0, fc: 0, inr: 0}};
            }
            const iNode = cNode.items[iLabel];

            if (!iNode.ports[pLabel]) {
                iNode.ports[pLabel] = {id: pId, entries: [], summary: {qty: 0, fc: 0, inr: 0}};
            }
            const pNode = iNode.ports[pLabel];

            pNode.entries.push(entry);
            add(pNode.summary, qty, fc, inr);
            add(iNode.summary, qty, fc, inr);
            add(cNode.totalSummary, qty, fc, inr);
        }
    }

    // Fast path: no sorting requested -> return object maps
    if (!sort || typeof sort !== "object") return companies;

    // Sort requested -> return arrays
    const toArray = (obj) => Object.entries(obj).map(([label, node]) => ({label, ...node}));
    const sortBy = (fn, arr) => (typeof fn === "function" ? [...arr].sort(fn) : arr);

    if (levels === 2) {
        const companiesArr = toArray(companies).map((c) => {
            const portsArr = toArray(c.ports);
            return {...c, ports: sortBy(sort.ports, portsArr)};
        });
        return sortBy(sort.companies, companiesArr);
    } else {
        const companiesArr = toArray(companies).map((c) => {
            const itemsArr = toArray(c.items).map((it) => {
                const portsArr = toArray(it.ports);
                return {...it, ports: sortBy(sort.ports, portsArr)};
            });
            return {...c, items: sortBy(sort.items, itemsArr)};
        });
        return sortBy(sort.companies, companiesArr);
    }
};
