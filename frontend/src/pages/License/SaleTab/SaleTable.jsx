// src/pages/License/SaleTable.jsx
import React from "react";
import {Badge, Button, Table} from "react-bootstrap";

const modeLabel = (mode) => {
    if (!mode) return "—";
    switch (String(mode).toLowerCase()) {
        case "kg":
            return "KG";
        case "cif":
        case "cif_inr":
            return "CIF %";
        case "fob":
        case "fob_inr":
            return "FOB %";
        default:
            return mode.toUpperCase();
    }
};

const saleTypeBadge = (type) => {
    const t = (type || "").toLowerCase();
    const variant = t === "full" ? "primary" : "secondary";
    return <Badge bg={variant}>{t === "full" ? "Full" : "Item-wise"}</Badge>;
};

const fmtAmt = (n) => {
    const x = Number(n || 0);
    return x.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

export default function SaleTable({invoices = [], onEdit, onDownload, onDelete}) {
    return (
        <Table bordered size="sm" responsive className="align-middle">
            <thead className="table-light">
            <tr>
                <th style={{width: 56}}>#</th>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Type / Mode</th>
                <th className="text-end" style={{width: 180}}>Amount (₹)</th>
                <th style={{width: 260}}>Actions</th>
            </tr>
            </thead>
            <tbody>
            {invoices.length === 0 ? (
                <tr>
                    <td colSpan={7} className="text-center text-muted">No sales yet.</td>
                </tr>
            ) : (
                invoices.map((inv, idx) => {
                    const invNo = inv?.invoice_number || "—";
                    const date = inv?.invoice_date || "—";
                    const customer = inv?.to_company_name || "—";
                    const amt = fmtAmt(inv?.total_amount);

                    return (
                        <tr key={inv?.id ?? idx}>
                            <td>{idx + 1}</td>
                            <td>#{invNo}</td>
                            <td>{date}</td>
                            <td>{customer}</td>
                            <td className="d-flex gap-2 align-items-center">
                                {saleTypeBadge(inv?.sale_type)}
                                <Badge bg="light" text="dark">{modeLabel(inv?.billing_mode)}</Badge>
                            </td>
                            <td className="text-end">{amt}</td>
                            <td className="d-flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    onClick={() => onEdit?.(inv)}
                                >
                                    View / Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline-primary"
                                    onClick={() => onDownload?.(inv)}
                                    disabled={!onDownload}
                                >
                                    PDF
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => onDelete?.(inv)}
                                    disabled={!onDelete}
                                >
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    );
                })
            )}
            </tbody>
        </Table>
    );
}
