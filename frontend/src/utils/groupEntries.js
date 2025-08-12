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
        const portName = entry?.port?.code || "Unknown Port";

        // Item & Product names (independent groupings)
        const itemName =
            entry?.item_name ||
            entry?.product_name ||
            "Unknown Item";

        const productName =
            entry?.product_name ||
            entry?.item_name ||
            entry?.item?.name ||
            "Unknown Product";

        const qty = safeNum(entry?.get_total_quantity);
        const fc = safeNum(entry?.get_total_fc);
        const inr = safeNum(entry?.get_total_inr);

        // Ensure company bucket
        if (!groups[companyName]) {
            groups[companyName] = {
                ports: {},     // company -> port -> entries (existing)
                items: {},     // company -> item -> (ports, entries)
                products: {},  // company -> product -> (ports, entries)
                totalSummary: {qty: 0, fc: 0, inr: 0},
            };
        }

        const companyBucket = groups[companyName];

        // ---- company -> ports (unchanged) ----
        if (!companyBucket.ports[portName]) {
            companyBucket.ports[portName] = {
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0},
            };
        }
        companyBucket.ports[portName].entries.push(entry);
        addToSummary(companyBucket.ports[portName].summary, qty, fc, inr);

        // ---- company -> items (by item_name) ----
        if (!companyBucket.items[itemName]) {
            companyBucket.items[itemName] = {
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0},
                ports: {},
            };
        }
        const itemBucket = companyBucket.items[itemName];
        itemBucket.entries.push(entry);
        addToSummary(itemBucket.summary, qty, fc, inr);
        if (!itemBucket.ports[portName]) {
            itemBucket.ports[portName] = {entries: [], summary: {qty: 0, fc: 0, inr: 0}};
        }
        itemBucket.ports[portName].entries.push(entry);
        addToSummary(itemBucket.ports[portName].summary, qty, fc, inr);

        // ---- company -> products (by product_name) ----
        if (!companyBucket.products[productName]) {
            companyBucket.products[productName] = {
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0},
                ports: {},
            };
        }
        const productBucket = companyBucket.products[productName];
        productBucket.entries.push(entry);
        addToSummary(productBucket.summary, qty, fc, inr);
        if (!productBucket.ports[portName]) {
            productBucket.ports[portName] = {entries: [], summary: {qty: 0, fc: 0, inr: 0}};
        }
        productBucket.ports[portName].entries.push(entry);
        addToSummary(productBucket.ports[portName].summary, qty, fc, inr);

        // ---- company totals (count once) ----
        addToSummary(companyBucket.totalSummary, qty, fc, inr);
    });

    return groups;
};
