// src/pages/Trade/helpers/groupingHelpers.js

export function tradeEntryTotals(entry) {
    const total = Number(entry?.total_amount || 0);
    const paid = Number(entry?.paid_total || 0);
    const due = Number(entry?.due_amount || (total - paid));
    return {total, paid, due};
}

export function tradeTotals(entries) {
    return (entries || []).reduce(
        (s, e) => {
            const {total, paid, due} = tradeEntryTotals(e);
            s.total += total;
            s.paid += paid;
            s.due += due;
            return s;
        },
        {total: 0, paid: 0, due: 0}
    );
}

export function getTradeGroupLabel(e) {
    return `${e?.direction || "-"} / ${
        e?.from_company?.name || e?.to_company?.name || "-"
    }`;
}

export default {tradeEntryTotals, tradeTotals, getTradeGroupLabel};
