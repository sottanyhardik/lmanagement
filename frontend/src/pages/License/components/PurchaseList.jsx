// src/pages/License/components/PurchaseList.jsx
import React from "react";
import {Badge, Table} from "react-bootstrap";

const fmt = (n) =>
    Number.isFinite(Number(n))
        ? Number(n).toLocaleString("en-IN", {maximumFractionDigits: 2})
        : "-";

export default function PurchaseList({purchases = []}) {
    if (!purchases.length) {
        return <div className="text-muted">No purchases recorded yet.</div>;
    }
    return (
        <Table bordered size="sm" responsive className="mb-3">
            <thead className="table-light">
            <tr>
                <th>#</th>
                <th>Supplier</th>
                <th>Invoice</th>
                <th>Basis</th>
                <th className="text-end">Amount (₹)</th>
                <th className="text-center">Copy</th>
            </tr>
            </thead>
            <tbody>
            {purchases.map((row, i) => (
                <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td>{row.supplier?.name || "-"}</td>
                    <td>
                        {row.invoice_number || "-"}
                        {row.invoice_date ? (
                            <Badge bg="secondary" className="ms-2">
                                {row.invoice_date}
                            </Badge>
                        ) : null}
                    </td>
                    <td>{row.basis}</td>
                    <td className="text-end">{fmt(row.amount_inr)}</td>
                    <td className="text-center">
                        {row.invoice_copy ? (
                            <a href={row.invoice_copy} target="_blank" rel="noreferrer">View</a>
                        ) : "—"}
                    </td>
                </tr>
            ))}
            </tbody>
        </Table>
    );
}
