export const groupEntries = (entries) => {
    const groups = {};

    entries.forEach(entry => {
        const companyName = entry.company?.name || 'Unknown Company';
        const portName = entry.port?.code || 'Unknown Port';

        const qty = parseFloat(entry.get_total_quantity || 0);
        const cif_fc = parseFloat(entry.get_total_fc || 0);
        const cif_inr = parseFloat(entry.get_total_inr || 0);

        if (!groups[companyName]) {
            groups[companyName] = {
                ports: {},
                totalSummary: {qty: 0, fc: 0, inr: 0}
            };
        }

        if (!groups[companyName].ports[portName]) {
            groups[companyName].ports[portName] = {
                entries: [],
                summary: {qty: 0, fc: 0, inr: 0}
            };
        }

        groups[companyName].ports[portName].entries.push(entry);
        groups[companyName].ports[portName].summary.qty += qty;
        groups[companyName].ports[portName].summary.fc += cif_fc;
        groups[companyName].ports[portName].summary.inr += cif_inr;

        groups[companyName].totalSummary.qty += qty;
        groups[companyName].totalSummary.fc += cif_fc;
        groups[companyName].totalSummary.inr += cif_inr;
    });

    return groups;
};
