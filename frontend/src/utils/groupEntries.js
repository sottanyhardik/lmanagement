// utils/groupEntries.js
export const groupEntries = (entries) => {
    const groups = {};

    const safeNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const addToSummary = (summary, qty, fc, inr) => {
        summary.qty += qty;
        summary.fc += fc;
        summary.inr += inr;
    };

    entries.forEach((entry) => {
        const companyName = entry?.company?.name || "Unknown Company";
        const itemName =
            entry?.item_name ||
            entry?.item?.name ||
            entry?.product?.name ||
            entry?.product_name ||
            "Unknown Item";
        const portCode = entry?.port?.code || "Unknown Port";

        const qty = safeNum(entry?.get_total_quantity);
        const fc = safeNum(entry?.get_total_fc);
        const inr = safeNum(entry?.get_total_inr);

        // Ensure company bucket
        if (!groups[companyName]) {
            groups[companyName] = {
                items: {},              // company -> item -> ports
                totalSummary: {qty: 0, fc: 0, inr: 0},
            };
        }

        // Ensure item bucket
        if (!groups[companyName].items[itemName]) {
            groups[companyName].items[itemName] = {
                ports: {},              // item -> port -> entries
                summary: {qty: 0, fc: 0, inr: 0},
            };
        }

        // Ensure port bucket
        if (!groups[companyName].items[itemName].ports[portCode]) {
            groups[companyName].items[itemName].ports[portCode] = {
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0},
            };
        }

        // Push entry and roll up summaries
        const portBucket = groups[companyName].items[itemName].ports[portCode];
        portBucket.entries.push(entry);
        addToSummary(portBucket.summary, qty, fc, inr);

        addToSummary(groups[companyName].items[itemName].summary, qty, fc, inr);
        addToSummary(groups[companyName].totalSummary, qty, fc, inr);
    });

    return groups;
};
