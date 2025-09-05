// src/pages/License/SaleTab.jsx
import React, {useState} from "react";
import {Button, Table} from "react-bootstrap";
// ⬇️ match your current file location from canvas
import LicenseInvoiceForm from "./SaleTab/LicenseInvoiceForm.jsx";

export default function SaleTab({entry, onSaved}) {
    const [showForm, setShowForm] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);

    const invoices = entry?.invoices || [];

    const openCreate = () => {
        setEditingInvoice(null);
        setShowForm(true);
    };

    const openEdit = (inv) => {
        setEditingInvoice(inv);
        setShowForm(true);
    };

    const handleSaved = () => {
        setShowForm(false);
        setEditingInvoice(null);
        onSaved && onSaved(entry.id);
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Sales</h6>
                <Button size="sm" onClick={openCreate}>Add New</Button>
            </div>

            {showForm && (
                <div className="border rounded p-3 mb-3 bg-light">
                    <LicenseInvoiceForm
                        // For edit: pass only the selected invoice so the form picks it up.
                        entry={editingInvoice ? {...entry, invoices: [editingInvoice]} : entry}
                        // sale type is now chosen inside the form
                        onSaved={handleSaved}
                    />
                </div>
            )}

            <Table bordered size="sm" responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{width: 60}}>#</th>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th className="text-end" style={{width: 160}}>Amount (₹)</th>
                    <th style={{width: 160}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {invoices.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="text-center text-muted">No sales yet.</td>
                    </tr>
                ) : (
                    invoices.map((inv, idx) => (
                        <tr key={inv.id || idx}>
                            <td>{idx + 1}</td>
                            <td>{inv.to_company_name}</td>
                            <td>#{inv.invoice_number || "—"}</td>
                            <td className="text-end">{Number(inv.total_amount || 0).toFixed(2)}</td>
                            <td>
                                <Button size="sm" variant="outline-secondary" onClick={() => openEdit(inv)}>
                                    View / Edit
                                </Button>
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </Table>
        </div>
    );
}
