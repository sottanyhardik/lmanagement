// src/pages/Trade/TradeHtmlView.jsx
import React from "react";
import {Table} from "react-bootstrap";
import TotalsInline from "./components/TotalsInline";

/**
 * Static-ish HTML view for a Trade record.
 * Adds a "Download PDF" button for SALE using entry.sale_pdf_url (if present).
 */
export default function TradeHtmlView({entry}) {
    if (!entry) return null;

    const isSale = String(entry.direction || "").toUpperCase() === "SALE";
    const pdfUrl = isSale ? entry.sale_pdf_url : null;

    return (
        <div className="p-3 bg-light rounded">
            <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <h5 className="mb-1">
                        {isSale ? "Sale Invoice" : "Purchase"} — {entry.invoice_number || "—"}
                    </h5>
                    <div className="text-muted small">Date: {entry.invoice_date || "—"}</div>
                </div>

                {isSale && pdfUrl && (
                    <div>
                        <a
                            className="btn btn-sm btn-primary"
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Download PDF
                        </a>
                    </div>
                )}
            </div>

            <div className="row mb-3">
                <div className="col-md-6">
                    <h6>From Company</h6>
                    <div>{entry?.from_company?.name || "—"}</div>
                    <div>PAN: {entry.from_pan || "—"} | GST: {entry.from_gst || "—"}</div>
                    <div>{entry.from_addr_line_1 || "—"}</div>
                    <div>{entry.from_addr_line_2 || ""}</div>
                </div>
                <div className="col-md-6">
                    <h6>To Company</h6>
                    <div>{entry?.to_company?.name || "—"}</div>
                    <div>PAN: {entry.to_pan || "—"} | GST: {entry.to_gst || "—"}</div>
                    <div>{entry.to_addr_line_1 || "—"}</div>
                    <div>{entry.to_addr_line_2 || ""}</div>
                </div>
            </div>

            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>#</th>
                    <th>SR / License</th>
                    <th>Mode</th>
                    <th className="text-end">Qty (Kg)</th>
                    <th className="text-end">Rate ₹/kg</th>
                    <th className="text-end">CIF ₹</th>
                    <th className="text-end">FOB ₹</th>
                    <th className="text-end">% (pct)</th>
                    <th className="text-end">Amount ₹</th>
                </tr>
                </thead>
                <tbody>
                {(entry.lines || []).map((ln, idx) => (
                    <tr key={ln.id || idx}>
                        <td>{idx + 1}</td>
                        <td>{ln?.sr_number?.license_no || ln?.sr_number?.license_number || "—"}</td>
                        <td>{ln.mode}</td>
                        <td className="text-end">{ln.qty_kg ?? 0}</td>
                        <td className="text-end">{ln.rate_inr_per_kg ?? 0}</td>
                        <td className="text-end">{ln.cif_inr ?? 0}</td>
                        <td className="text-end">{ln.fob_inr ?? 0}</td>
                        <td className="text-end">{ln.pct ?? 0}</td>
                        <td className="text-end">{Number(ln.amount_inr || 0).toFixed(2)}</td>
                    </tr>
                ))}
                </tbody>
            </Table>

            <TotalsInline
                subtotal={entry.subtotal_amount}
                roundoff={entry.roundoff}
                total={entry.total_amount}
                paid={entry.paid_total}
                due={entry.due_amount}
            />
        </div>
    );
}
