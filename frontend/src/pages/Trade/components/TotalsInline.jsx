import React from "react";
import {Col, Row} from "react-bootstrap";

const fmt2 = (v) =>
    Number(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

/**
 * TotalsInline
 * Shows Subtotal, Roundoff, Total, Settled, Due for a trade entry.
 *
 * Props:
 *  - entry: {
 *      subtotal_amount?, roundoff?, total_amount?,
 *      paid_total?, due_amount?
 *    }
 *  - className?: string
 */
export default function TotalsInline({entry = {}, className = ""}) {
    const subtotal = Number(entry?.subtotal_amount || 0);
    const roundoff =
        entry?.roundoff != null ? Number(entry.roundoff) : Math.round(subtotal) - subtotal;
    const total =
        entry?.total_amount != null ? Number(entry.total_amount) : subtotal + roundoff;
    const paid = Number(entry?.paid_total || 0);
    const due =
        entry?.due_amount != null ? Number(entry.due_amount) : total - paid;

    return (
        <Row className={`g-3 ${className}`}>
            <Col md={3}>
                <div className="p-3 bg-light rounded">
                    Subtotal ₹ <strong>{fmt2(subtotal)}</strong>
                </div>
            </Col>
            <Col md={3}>
                <div className="p-3 bg-light rounded">
                    Roundoff ₹ <strong>{fmt2(roundoff)}</strong>
                </div>
            </Col>
            <Col md={3}>
                <div className="p-3 bg-light rounded">
                    Total ₹ <strong>{fmt2(total)}</strong>
                </div>
            </Col>
            <Col md={3}>
                <div className="p-3 bg-light rounded">
                    Settled ₹ <strong>{fmt2(paid)}</strong>
                    <div className="small text-muted">Due ₹ {fmt2(due)}</div>
                </div>
            </Col>
        </Row>
    );
}
