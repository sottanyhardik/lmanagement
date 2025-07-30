export const groupEntries = (entries) => {
    const groups = {};
    entries.forEach(entry => {
        const companyName = entry.company?.name || 'Unknown Company';
        const date = new Date(entry.bill_of_entry_date);
        const month = date.toLocaleString('default', {month: 'long', year: 'numeric'});
        const portName = entry.port?.code || 'Unknown Port';

        const qty = parseFloat(entry.get_total_quantity || 0);
        const cif_fc = parseFloat(entry.get_total_fc || 0);
        const cif_inr = parseFloat(entry.get_total_inr || 0);

        if (!groups[companyName]) groups[companyName] = {};
        if (!groups[companyName][month]) groups[companyName][month] = {};
        if (!groups[companyName][month][portName]) {
            groups[companyName][month][portName] = {entries: [], summary: {qty: 0, fc: 0, inr: 0}};
        }

        groups[companyName][month][portName].entries.push(entry);
        groups[companyName][month][portName].summary.qty += qty;
        groups[companyName][month][portName].summary.fc += cif_fc;
        groups[companyName][month][portName].summary.inr += cif_inr;
    });
    return groups;
};
