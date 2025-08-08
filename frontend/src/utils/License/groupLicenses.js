export const groupLicenses = (entries = []) => {
    const grouped = {};

    for (const entry of entries) {
        const exporter = entry.exporter?.name || 'Unknown Exporter';
        const port = entry.port?.name || 'Unknown Port';

        if (!grouped[exporter]) {
            grouped[exporter] = {ports: {}};
        }

        if (!grouped[exporter].ports[port]) {
            grouped[exporter].ports[port] = [];
        }

        grouped[exporter].ports[port].push(entry);
    }

    return grouped;
};