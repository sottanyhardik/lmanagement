// src/pages/License/LicenseTableView.jsx
import React, {useMemo} from "react";

/**
 * Normal Bootstrap table view for a License entry.
 * Uses the same data shape as your sample "entry" object.
 * No custom CSS — only Bootstrap table classes.
 */
const LicenseTableView = ({entry}) => {
    if (!entry) return null;

    // ---- helpers ----
    const num = (v) => {
        const n = parseFloat(String(v ?? "").replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
    };
    const fmt = (v, digits = 2) => {
        const n = num(v);
        return n === null ? "-" : n.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    };
    const text = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

    const exporterName = entry.exporter?.name || entry.exporter_name || "-";
    const portName = entry.port?.name || entry.port?.code || entry.port_name || "-";

    const exportItems = Array.isArray(entry.export_license) ? entry.export_license : [];
    const importItems = Array.isArray(entry.import_license) ? entry.import_license : [];

    // totals (prefer BE-provided; else compute)
    const totalDebit = useMemo(() => {
        if (entry.get_total_debit != null) return fmt(entry.get_total_debit);
        const s = importItems.reduce((acc, it) => acc + (num(it.debited_value) ?? 0), 0);
        return fmt(s);
    }, [entry.get_total_debit, importItems]);

    const totalAllotted = useMemo(() => {
        if (entry.get_total_allotment != null) return fmt(entry.get_total_allotment);
        const s = importItems.reduce((acc, it) => acc + (num(it.allotted_value) ?? 0), 0);
        return fmt(s);
    }, [entry.get_total_allotment, importItems]);

    const totalBalanceUsd = useMemo(() => {
        if (entry.get_balance_cif != null) return fmt(entry.get_balance_cif);
        const s = importItems.reduce((acc, it) => acc + (num(it.available_value) ?? 0), 0);
        return fmt(s);
    }, [entry.get_balance_cif, importItems]);

    return (
        <div className="license-table-view">

            {/* Header Block 2 */}
            <table className="table table-bordered table-striped table-sm mb-3">
                <thead>
                <tr>
                    <th>Notification</th>
                    <th>Scheme Code</th>
                    <th>Port</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <td>{text(entry.notification_number)}</td>
                    <td>{text(entry.scheme_code)}</td>
                    <td>{text(portName)}</td>
                </tr>
                </tbody>
            </table>

            {/* Import Items */}
            <h6 className="mb-2">Import Items</h6>
            <table className="table table-bordered table-striped table-sm">
                <thead>
                <tr>
                    <th>Sr No</th>
                    <th>HS Code</th>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Value</th>
                    <th>Debited Qty</th>
                    <th>Debited USD</th>
                    <th>Allotted Qty</th>
                    <th>Allotted USD</th>
                    <th>Balance Qty</th>
                    <th>Balance USD</th>
                </tr>
                </thead>
                <tbody>
                {importItems.length === 0 ? (
                    <tr>
                        <td colSpan={12}>-</td>
                    </tr>
                ) : importItems.map((im) => {
                    const hs = im.hs_code?.hs_code || im.hs_code || "-";
                    const itemText = [
                            im.item,
                            im.description,
                        ].filter(Boolean).join(" - ") ||
                        (Array.isArray(im.items) && im.items.length
                            ? im.items.map((it) => it.name).join(", ")
                            : "-");

                    return (
                        <tr key={im.id}>
                            <td>{text(im.serial_number)}</td>
                            <td>{text(hs)}</td>
                            <td>{text(itemText)}</td>

                            <td className="text-end">{num(im.quantity) ? fmt(im.quantity, 3) : "-"}</td>
                            <td className="text-end">{num(im.cif_fc) ? fmt(im.cif_fc) : "-"}</td>

                            <td className="text-end">{num(im.debited_quantity) ? fmt(im.debited_quantity, 3) : "-"}</td>
                            <td className="text-end">{num(im.debited_value) ? fmt(im.debited_value) : "-"}</td>

                            <td className="text-end">{num(im.allotted_quantity) ? fmt(im.allotted_quantity, 3) : "-"}</td>
                            <td className="text-end">{num(im.allotted_value) ? fmt(im.allotted_value) : "-"}</td>

                            <td className="text-end">{num(im.available_quantity) ? fmt(im.available_quantity, 3) : "-"}</td>
                            <td className="text-end">{num(im.available_value) ? fmt(im.available_value) : "-"}</td>
                        </tr>
                    );
                })}
                </tbody>
                <tfoot>
                <tr>
                    <td colSpan={5}></td>
                    <td> Total Debit USD</td>
                    <td className="text-end"><b>{totalDebit}</b></td>
                    <td> Total Allotted USD</td>
                    <td className="text-end"><b>{totalAllotted}</b></td>
                    <td> Total Balance USD</td>
                    <td className="text-end"><b>{totalBalanceUsd}</b></td>
                </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default LicenseTableView;
