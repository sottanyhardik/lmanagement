// src/pages/Trade/form/tabs/LinesTab.jsx
import React, {useMemo, useState} from "react";
import {Button, Col, Form, Row} from "react-bootstrap";
import TradeLinesTable from "../../TradeLinesTable";

/**
 * LinesTab — wraps TradeLinesTable and adds small bulk helpers
 * to mirror the InvoiceForm UX ("copy rate to all" / "copy first row's rate").
 *
 * Props:
 *  - rows, setRows
 *  - direction
 *  - boeId
 *  - errors
 */
export default function LinesTab({rows, setRows, direction, boeId, errors}) {
    const [bulkRate, setBulkRate] = useState("");

    const applyToAll = () => {
        const r = Number(bulkRate);
        if (!Number.isFinite(r)) return;
        const next = (rows || []).map((it) => ({
            ...it,
            // QTY mode → rate_inr_per_kg; Value modes → pct
            rate_inr_per_kg: (it.mode || "QTY") === "QTY" ? String(r) : it.rate_inr_per_kg || "0",
            pct: ["CIF_INR", "FOB_INR"].includes(it.mode || "QTY") ? String(r) : it.pct || "0",
        }));
        setRows(next);
    };

    const copyFirst = () => {
        if (!rows?.length) return;
        const first = rows[0];
        const isQty = (first.mode || "QTY") === "QTY";
        const val = isQty ? Number(first.rate_inr_per_kg || 0) : Number(first.pct || 0);
        if (!Number.isFinite(val)) return;
        setBulkRate(String(val));
        setTimeout(applyToAll, 0);
    };

    const label = useMemo(() => {
        const q = (rows || []).filter((r) => (r.mode || "QTY") === "QTY").length;
        return q >= (rows?.length || 0) / 2 ? "Rate ₹/kg (apply to all)" : "Rate % (apply to all)";
    }, [rows]);

    return (
        <>
            <Row className="g-2 mb-2 align-items-end">
                <Col md={3}>
                    <Form.Label className="small">{label}</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={bulkRate}
                        onChange={(e) => setBulkRate(e.target.value)}
                        placeholder="e.g. 12.50 or 5"
                    />
                </Col>
                <Col md="auto">
                    <Button size="sm" variant="outline-secondary" className="mt-3" onClick={applyToAll}>
                        Apply to all rows
                    </Button>
                </Col>
                <Col md="auto">
                    <Button size="sm" variant="outline-secondary" className="mt-3" onClick={copyFirst}>
                        Copy first row’s rate → all
                    </Button>
                </Col>
            </Row>

            <TradeLinesTable
                rows={rows}
                setRows={setRows}
                direction={direction}
                boeId={boeId}
                errors={errors}
            />
        </>
    );
}
