// src/pages/Trade/TradeTab.jsx
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

export default function TradeTab({direction, license}) {
    const licenseId = license?.id ?? null;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showNew, setShowNew] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const fetchRows = async () => {
        setLoading(true);
        try {
            // If license present, filter; else fetch all trades for the direction
            const params = {direction};
            if (licenseId) params.license = licenseId;

            const {data} = await axios.get(`/trades/`, {params});
            const list = Array.isArray(data?.results) ? data.results : data || [];
            setRows(list);
        } catch (e) {
            console.error(e);
            setRows([]);
            toast.error("Failed to load trades");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setEditingId(null);
        setShowNew(false);
        fetchRows(); // eslint-disable-line react-hooks/exhaustive-deps
    }, [direction, licenseId]);

    const total = useMemo(
        () => (rows || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
        [rows]
    );

    return (
        <Container className="mt-3">
            {/* Header row in the same spirit as LicenseList */}
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">
                    {direction === "PURCHASE" ? "Purchases" : "Sales"}
                    {licenseId ? (
                        <Badge bg="secondary" className="ms-2">
                            L#{license?.license_number ?? licenseId}
                        </Badge>
                    ) : null}
                </h6>
                <div className="d-flex align-items-center gap-3">
                    <Badge bg="success">Total ₹ {fmt(total)}</Badge>
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
                        direction={direction}
                        // If you want to lock lines to a license when inside the license card,
                        // pass initial with anything you need; otherwise blank is fine.
                        initial={{direction}}
                        onSaved={() => {
                            setShowNew(false);
                            fetchRows();
                        }}
                        onClose={() => setShowNew(false)}
                    />
                </div>
            )}

            <Table bordered size="sm" responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{width: 60}}>#</th>
                    <th>From (Company)</th>
                    <th>To (Company)</th>
                    <th>Invoice</th>
                    <th>Basis</th>
                    <th className="text-end" style={{width: 140}}>
                        Round Off (₹)
                    </th>
                    <th className="text-end" style={{width: 160}}>
                        Total (₹)
                    </th>
                    <th style={{width: 90}}/>
                </tr>
                </thead>
                <tbody>
                {!loading && rows?.length === 0 && (
                    <tr>
                        <td colSpan={8} className="text-center text-muted">
                            No trades yet
                        </td>
                    </tr>
                )}

                {rows.map((r, idx) => (
                    <React.Fragment key={r.id}>
                        <tr>
                            <td>{idx + 1}</td>
                            <td>{r?.from_company?.name ?? r?.from_company_name ?? "—"}</td>
                            <td>{r?.to_company?.name ?? r?.to_company_name ?? "—"}</td>
                            <td>
                                {r.invoice_number || "-"}
                                {r.invoice_date ? (
                                    <Badge bg="secondary" className="ms-2">
                                        {r.invoice_date}
                                    </Badge>
                                ) : null}
                            </td>
                            <td className="text-muted">{basisText(r)}</td>
                            <td className="text-end">{fmt(r.roundoff ?? 0)}</td>
                            <td className="text-end">{fmt(r.total_amount ?? 0)}</td>
                            <td className="text-center">
                                <Button
                                    size="sm"
                                    variant={editingId === r.id ? "outline-secondary" : "outline-primary"}
                                    onClick={() => {
                                        setShowNew(false);
                                        setEditingId((cur) => (cur === r.id ? null : r.id));
                                    }}
                                >
                                    {editingId === r.id ? "Close" : "Edit"}
                                </Button>
                            </td>
                        </tr>

                        {editingId === r.id && (
                            <tr>
                                <td colSpan={8}>
                                    <TradeForm
                                        direction={direction}
                                        initial={r}
                                        onSaved={() => {
                                            setEditingId(null);
                                            fetchRows();
                                        }}
                                        onClose={() => setEditingId(null)}
                                    />
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}

                {loading && (
                    <tr>
                        <td colSpan={8} className="text-center text-muted">
                            Loading…
                        </td>
                    </tr>
                )}
                </tbody>
            </Table>
        </Container>
    );
}
