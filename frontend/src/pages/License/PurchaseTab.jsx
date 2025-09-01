import React, {useEffect, useMemo, useState} from "react";
import {Badge, Button, Table} from "react-bootstrap";
import axios from "../../api/axiosInstance";
import {toast} from "react-toastify";
import PurchaseForm from "./components/PurchaseForm";

const fmt = (n) =>
    Number.isFinite(Number(n))
        ? Number(n).toLocaleString("en-IN", {maximumFractionDigits: 2})
        : "-";

const basisText = (p) => {
    if (p.mode === "QTY") {
        const left = p.product_name ? `${p.product_name} • ` : "";
        return `${left}${p.quantity_kg || 0} kg @ ₹${p.rate_inr || 0}`;
    }
    const srcLabel =
        p.amount_source === "CIF_USD" ? "CIF $"
            : p.amount_source === "CIF_INR" ? "CIF ₹"
                : "FOB ₹";
    let base = "";
    if (p.amount_source === "CIF_USD") {
        base = `${p.cif_usd || 0} × ${p.exchange_rate || 0}`;
    } else if (p.amount_source === "CIF_INR") {
        base = `${p.cif_inr || 0}`;
    } else {
        base = `${p.fob_inr || 0}`;
    }
    const rate = Number(p.markup_pct || 0);
    const add = rate ? `, +${rate}%` : "";
    return `Amount • ${srcLabel}: ${base}${add}`;
};

export default function PurchaseTab({entry}) {
    const licenseId = entry?.id;
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showNew, setShowNew] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const fetchRows = async () => {
        if (!licenseId) return;
        setLoading(true);
        try {
            const {data} = await axios.get(`/license-purchases/?license=${licenseId}`);
            setRows(Array.isArray(data?.results) ? data.results : data);
        } catch (e) {
            console.error(e);
            setRows([]);
            toast.error("Failed to load purchases");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows(); /* eslint-disable-next-line */
    }, [licenseId]);

    const total = useMemo(
        () => (rows || []).reduce((s, r) => s + (Number(r.amount_inr) || 0), 0),
        [rows]
    );

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Purchases</h6>
                <div className="d-flex align-items-center gap-3">
                    <Badge bg="success">Total ₹ {fmt(total)}</Badge>
                    <Button size="sm" onClick={() => {
                        setShowNew((v) => !v);
                        setEditingId(null);
                    }}>
                        {showNew ? "Close" : "Add New"}
                    </Button>
                </div>
            </div>

            {showNew && (
                <div className="mb-3">
                    <PurchaseForm
                        licenseId={licenseId}
                        onSaved={() => {
                            setShowNew(false);
                            fetchRows();
                        }}
                    />
                </div>
            )}

            <Table bordered size="sm" responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{width: 60}}>#</th>
                    <th>Supplier</th>
                    <th>Invoice</th>
                    <th>Basis</th>
                    <th className="text-end" style={{width: 160}}>Amount (₹)</th>
                    <th style={{width: 100}}>Copy</th>
                    <th style={{width: 90}}/>
                </tr>
                </thead>
                <tbody>
                {!loading && rows?.length === 0 && (
                    <tr>
                        <td colSpan={7} className="text-center text-muted">No purchases yet</td>
                    </tr>
                )}

                {rows.map((r, idx) => (
                    <React.Fragment key={r.id}>
                        <tr>
                            <td>{idx + 1}</td>
                            <td>{r.supplier_name || "-"}</td>
                            <td>
                                {r.invoice_number || "-"}
                                {r.invoice_date ? (
                                    <Badge bg="secondary" className="ms-2">{r.invoice_date}</Badge>
                                ) : null}
                            </td>
                            <td className="text-muted">{basisText(r)}</td>
                            <td className="text-end">{fmt(r.amount_inr)}</td>
                            <td>
                                {r.invoice_copy_url ? (
                                    <a href={r.invoice_copy_url} target="_blank" rel="noreferrer">Open</a>
                                ) : "—"}
                            </td>
                            <td className="text-center">
                                <Button
                                    size="sm"
                                    variant={editingId === r.id ? "outline-secondary" : "outline-primary"}
                                    onClick={() => setEditingId((cur) => cur === r.id ? null : r.id)}
                                >
                                    {editingId === r.id ? "Close" : "Edit"}
                                </Button>
                            </td>
                        </tr>
                        <tr>
                            <hr/>
                        </tr>

                        {editingId === r.id && (
                            <tr>
                                <td colSpan={7}>
                                    <PurchaseForm
                                        licenseId={licenseId}
                                        initial={r}
                                        purchaseId={r.id}
                                        compact
                                        onCancel={() => setEditingId(null)}
                                        onSaved={() => {
                                            setEditingId(null);
                                            fetchRows();
                                        }}
                                    />
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}

                {loading && (
                    <tr>
                        <td colSpan={7} className="text-center text-muted">Loading…</td>
                    </tr>
                )}
                </tbody>
            </Table>
        </div>
    );
}
