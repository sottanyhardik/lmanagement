// src/pages/Trade/AllSales.jsx
import React, {useEffect, useMemo, useState} from "react";
import {Badge, Button, Container, Table} from "react-bootstrap";
import axios from "../../api/axiosInstance";
import {toast} from "react-toastify";
import TradeForm from "./TradeForm";

const fmt = (n) =>
    Number.isFinite(Number(n))
        ? Number(n).toLocaleString("en-IN", {maximumFractionDigits: 2})
        : "-";

const basisText = (r) => {
    const lines = Array.isArray(r?.lines) ? r.lines : [];
    if (!lines.length) return "—";
    const l = lines[0];
    if (l.mode === "QTY") return `${l.qty_kg || 0} kg @ ₹${l.rate_inr_per_kg || 0}`;
    if (l.mode === "CIF_INR") return `CIF ₹: ${l.cif_inr || 0} × ${l.pct || 0}%`;
    if (l.mode === "FOB_INR") return `FOB ₹: ${l.fob_inr || 0} × ${l.pct || 0}%`;
    return "—";
};

export default function AllSales() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const fetchRows = async () => {
        setLoading(true);
        try {
            const {data} = await axios.get(`/trades/`, {params: {direction: "SALE"}});
            setRows(Array.isArray(data?.results) ? data.results : data || []);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load sales");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
    }, []);

    const total = useMemo(
        () => (rows || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
        [rows]
    );
    const totalDue = useMemo(
        () => (rows || []).reduce((s, r) => s + (Number(r.due_amount) || 0), 0),
        [rows]
    );

    return (
        <Container className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">💸 All Sales</h5>
                <div className="d-flex align-items-center gap-3">
                    <Badge bg="secondary">Total ₹ {fmt(total)}</Badge>
                    <Badge bg="warning">Total Due ₹ {fmt(totalDue)}</Badge>
                    <Button
                        size="sm"
                        onClick={() => {
                            setShowNew((v) => !v);
                            setEditingId(null);
                        }}
                    >
                        {showNew ? "Close" : "Add New"}
                    </Button>
                </div>
            </div>

            {showNew && (
                <div className="mb-3">
                    <TradeForm
                        direction="SALE"
                        onSaved={() => {
                            setShowNew(false);
                            fetchRows();
                        }}
                        onClose={() => setShowNew(false)}  // ← match TradeForm API
                    />
                </div>
            )}

            <Table bordered size="sm" responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{width: 60}}>#</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Invoice</th>
                    <th>Basis</th>
                    <th className="text-end">Subtotal (₹)</th>
                    <th className="text-end">Round Off (₹)</th>
                    <th className="text-end">Total (₹)</th>
                    <th className="text-end">Received (₹)</th>
                    <th className="text-end">Due (₹)</th>
                    <th style={{width: 120}}>Invoice PDF</th>
                    <th style={{width: 100}}/>
                </tr>
                </thead>
                <tbody>
                {!loading && rows.length === 0 && (
                    <tr>
                        <td colSpan={12} className="text-center text-muted">
                            No sales yet.
                        </td>
                    </tr>
                )}

                {rows.map((r, i) => (
                    <React.Fragment key={r.id}>
                        <tr>
                            <td>{i + 1}</td>
                            <td>{r?.from_company?.name ?? "—"}</td>
                            <td>{r?.to_company?.name ?? "—"}</td>
                            <td>
                                {r.invoice_number || "-"}
                                {r.invoice_date ? (
                                    <Badge bg="secondary" className="ms-2">
                                        {r.invoice_date}
                                    </Badge>
                                ) : null}
                            </td>
                            <td className="text-muted">{basisText(r)}</td>
                            <td className="text-end">{fmt(r.subtotal_amount)}</td>
                            <td className="text-end">{fmt(r.roundoff)}</td>
                            <td className="text-end">{fmt(r.total_amount)}</td>
                            <td className="text-end">{fmt(r.paid_total)}</td>
                            <td className="text-end fw-semibold">{fmt(r.due_amount)}</td>
                            <td>
                                {r.sale_pdf_url ? (
                                    <a href={r.sale_pdf_url} target="_blank" rel="noreferrer">
                                        Download
                                    </a>
                                ) : (
                                    "—"
                                )}
                            </td>
                            <td className="text-center">
                                <Button
                                    size="sm"
                                    variant={editingId === r.id ? "outline-secondary" : "outline-primary"}
                                    onClick={() => setEditingId((cur) => (cur === r.id ? null : r.id))}
                                >
                                    {editingId === r.id ? "Close" : "Edit"}
                                </Button>
                            </td>
                        </tr>

                        {editingId === r.id && (
                            <tr>
                                <td colSpan={12}>
                                    <TradeForm
                                        direction="SALE"
                                        initial={r}
                                        onClose={() => setEditingId(null)}
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
                        <td colSpan={12} className="text-center text-muted">
                            Loading…
                        </td>
                    </tr>
                )}
                </tbody>
            </Table>
        </Container>
    );
}
