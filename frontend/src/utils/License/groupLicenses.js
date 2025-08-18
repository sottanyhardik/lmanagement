// src/utils/License/groupLicenses.js

/**
 * Group licenses by Exporter → Port.
 * Returns an array tree that's easy to render.
 *
 * @param {Array<any>} entries
 * @param {Object} options
 * @param {(e:any)=>string} [options.getExporter]  pick exporter label
 * @param {(e:any)=>string} [options.getPort]      pick port label
 * @param {(a,b)=>number}   [options.sortExporters] optional comparator for exporter groups
 * @param {(a,b)=>number}   [options.sortPorts]     optional comparator for ports within a group
 * @returns {Array<{exporter:string, count:number, ports:Array<{port:string, entries:any[]}>}>}
 */
export function groupLicenses(
    entries = [],
    {
        getExporter = (e) => e?.exporter?.name ?? 'Unknown Exporter',
        getPort = (e) => e?.port?.name ?? e?.port?.code ?? 'Unknown Port',
        sortExporters = null,
        sortPorts = null,
    } = {}
) {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const norm = (s) => {
        const t = (s ?? '').toString().trim();
        return t || '—';
    };

    const expMap = new Map(); // exporter -> { exporter, portsMap, count }

    for (const e of entries) {
        const exporter = norm(getExporter(e));
        const port = norm(getPort(e));

        let expBucket = expMap.get(exporter);
        if (!expBucket) {
            expBucket = {exporter, portsMap: new Map(), count: 0};
            expMap.set(exporter, expBucket);
        }

        let portBucket = expBucket.portsMap.get(port);
        if (!portBucket) {
            portBucket = {port, entries: []};
            expBucket.portsMap.set(port, portBucket);
        }

        portBucket.entries.push(e);
        expBucket.count++;
    }

    // Materialize + optional sorting
    let result = Array.from(expMap.values()).map((exp) => {
        let ports = Array.from(exp.portsMap.values());
        if (typeof sortPorts === 'function') ports.sort(sortPorts);
        return {exporter: exp.exporter, count: exp.count, ports};
    });

    if (typeof sortExporters === 'function') result.sort(sortExporters);
    return result;
}

/**
 * Back-compat: convert the array tree to your original object shape.
 * {
 *   [exporter]: {
 *     ports: {
 *       [port]: [entry, ...]
 *     }
 *   }
 * }
 */
export function groupLicensesAsObject(entries = [], opts) {
    const tree = groupLicenses(entries, opts);
    const out = {};
    for (const g of tree) {
        out[g.exporter] = {ports: {}};
        for (const p of g.ports) {
            out[g.exporter].ports[p.port] = p.entries;
        }
    }
    return out;
}
