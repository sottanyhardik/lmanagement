// src/utils/groupEntries.js

/**
 * @typedef {Object} Summary
 * @property {number} qty
 * @property {number} fc
 * @property {number} inr
 */

/**
 * @typedef {Object} GroupedPort
 * @property {string} port
 * @property {Summary} summary
 * @property {any[]} entries
 */

/**
 * @typedef {Object} GroupedItem
 * @property {string} item
 * @property {Summary} summary
 * @property {GroupedPort[]} ports
 */

/**
 * @typedef {Object} GroupedCompany
 * @property {string} company
 * @property {Summary} totalSummary
 * @property {GroupedItem[]} items
 */

/**
 * Safe numeric coercion (treats null/NaN/undefined/'' as 0)
 */
function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Add qty/fc/inr into a summary object (mutates target).
 */
function add(summary, qty, fc, inr) {
    summary.qty += qty;
    summary.fc += fc;
    summary.inr += inr;
}

/**
 * Default selectors (match your current backend fields).
 * You can override any of these via the `options` param.
 */
const defaultSelectors = {
    getCompany: e => e?.company?.name ?? 'Unknown Company',
    getItem: e => e?.item_name ?? e?.item?.name ?? e?.product?.name ?? e?.product_name ?? 'Unknown Item',
    getPort: e => e?.port?.code ?? 'Unknown Port',
    getQty: e => toNum(e?.get_total_quantity),
    getFc: e => toNum(e?.get_total_fc),
    getInr: e => toNum(e?.get_total_inr),
};

/**
 * Optional sorters; return falsy to keep insertion order.
 * Provide your own to sort by totals, etc.
 */
const defaultSorters = {
    sortCompanies: null,       // (a: GroupedCompany, b: GroupedCompany) => number
    sortItems: null,       // (a: GroupedItem, b: GroupedItem) => number
    sortPorts: null,       // (a: GroupedPort, b: GroupedPort) => number
};

/**
 * Group entries → Company → Item → Port with rolled-up summaries.
 *
 * @param {any[]} entries
 * @param {Object} [options]
 * @param {Function} [options.getCompany]
 * @param {Function} [options.getItem]
 * @param {Function} [options.getPort]
 * @param {Function} [options.getQty]
 * @param {Function} [options.getFc]
 * @param {Function} [options.getInr]
 * @param {Function} [options.sortCompanies] comparator for top-level
 * @param {Function} [options.sortItems] comparator for items
 * @param {Function} [options.sortPorts] comparator for ports
 * @returns {GroupedCompany[]}
 */
export function groupEntries(entries, options = {}) {
    const sel = {...defaultSelectors, ...options};
    const cmp = {...defaultSorters, ...options};

    // company -> item -> port
    const companyMap = new Map();

    for (const e of entries || []) {
        const company = String(sel.getCompany(e));
        const item = String(sel.getItem(e));
        const port = String(sel.getPort(e));
        const qty = sel.getQty(e);
        const fc = sel.getFc(e);
        const inr = sel.getInr(e);

        // company bucket
        let c = companyMap.get(company);
        if (!c) {
            c = {
                company,
                itemsMap: new Map(),
                totalSummary: {qty: 0, fc: 0, inr: 0},
            };
            companyMap.set(company, c);
        }

        // item bucket
        let i = c.itemsMap.get(item);
        if (!i) {
            i = {
                item,
                portsMap: new Map(),
                summary: {qty: 0, fc: 0, inr: 0},
            };
            c.itemsMap.set(item, i);
        }

        // port bucket
        let p = i.portsMap.get(port);
        if (!p) {
            p = {
                port,
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0},
            };
            i.portsMap.set(port, p);
        }

        // push entry + rollups
        p.entries.push(e);
        add(p.summary, qty, fc, inr);
        add(i.summary, qty, fc, inr);
        add(c.totalSummary, qty, fc, inr);
    }

    // materialize to arrays (and sort if requested)
    let companies = Array.from(companyMap.values()).map(c => {
        let items = Array.from(c.itemsMap.values()).map(i => {
            let ports = Array.from(i.portsMap.values());
            if (typeof cmp.sortPorts === 'function') ports.sort(cmp.sortPorts);
            return {item: i.item, summary: i.summary, ports};
        });
        if (typeof cmp.sortItems === 'function') items.sort(cmp.sortItems);
        return {company: c.company, totalSummary: c.totalSummary, items};
    });

    if (typeof cmp.sortCompanies === 'function') companies.sort(cmp.sortCompanies);

    return companies;
}

/* -------------------------
   Convenience: object shape
   -------------------------
   If you still need an object keyed by names (like your original),
   you can convert the array tree back:
*/
export function groupEntriesAsObject(entries, options = {}) {
    const tree = groupEntries(entries, options);
    const out = {};
    for (const c of tree) {
        out[c.company] = {
            items: {},
            totalSummary: c.totalSummary,
        };
        for (const it of c.items) {
            out[c.company].items[it.item] = {
                ports: {},
                summary: it.summary,
            };
            for (const p of it.ports) {
                out[c.company].items[it.item].ports[p.port] = {
                    entries: p.entries,
                    summary: p.summary,
                };
            }
        }
    }
    return out;
}

/* -------------------------
   Example custom sort usage:
   -------------------------
   groupEntries(data, {
     sortCompanies: (a, b) => b.totalSummary.inr - a.totalSummary.inr,
     sortItems:     (a, b) => a.item.localeCompare(b.item),
     sortPorts:     (a, b) => a.port.localeCompare(b.port),
   });
*/
