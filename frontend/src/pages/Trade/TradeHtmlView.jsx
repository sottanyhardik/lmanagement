import React from "react";

const cell = (v) => (v == null || v === "" ? "-" : String(v));

const TradeHtmlView = ({entry}) => {
    if (!entry) return null;

    const lines = Array.isArray(entry.lines) ? entry.lines : [];
    const payments = Array.isArray(entry.payments) ? entry.payments : [];
    const isSale = entry.direction === "SALE";
    const boeValue = entry.boe?.boe_number || entry.boe;

    return (
        <div>
            {/* Header */}
            <table className="table table-bordered table-sm mb-3">
                <tbody>
                <tr>
                    <th style={{width: "15%"}}>Invoice #</th>
                    <td style={{width: "15%"}}>{cell(entry.invoice_number)}</td>
                    <th style={{width: "15%"}}>Invoice Date</th>
                    <td style={{width: "15%"}}>{cell(entry.invoice_date)}</td>
                    {isSale ? (
                        <>
                            <th style={{width: "15%"}}>BOE</th>
                            <td style={{width: "15%"}}>{cell(boeValue)}</td>
                        </>
                    ) : (
                        <>
                            <th style={{width: "15%"}}></th>
                            <td style={{width: "15%"}}></td>
                        </>
                    )}
                </tr>

                {!isSale && entry.purchase_invoice_copy_url && (
                    <tr>
                        <th>Invoice Copy</th>
                        <td colSpan={3}>
                            <a href={entry.purchase_invoice_copy_url} target="_blank" rel="noreferrer">
                                View supplier invoice copy
                            </a>
                        </td>
                    </tr>
                )}
                </tbody>
            </table>

            {/* Party Snapshots */}
            <h6 className="mb-2">Party Details (Snapshots)</h6>
            <table className="table table-bordered table-sm mb-3">
                <thead className="table-light">
                <tr>
                    <th style={{width: "18%"}}></th>
                    <th>Company</th>
                    <th style={{width: "15%"}}>PAN</th>
                    <th style={{width: "18%"}}>GST</th>
                    <th>Address Line 1</th>
                    <th>Address Line 2</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <th>From</th>
                    <td>{cell(entry.from_company?.name)}</td>
                    <td>{cell(entry.from_pan)}</td>
                    <td>{cell(entry.from_gst)}</td>
                    <td>{cell(entry.from_addr_line_1)}</td>
                    <td>{cell(entry.from_addr_line_2)}</td>
                </tr>
                <tr>
                    <th>To</th>
                    <td>{cell(entry.to_company?.name)}</td>
                    <td>{cell(entry.to_pan)}</td>
                    <td>{cell(entry.to_gst)}</td>
                    <td>{cell(entry.to_addr_line_1)}</td>
                    <td>{cell(entry.to_addr_line_2)}</td>
                </tr>
                </tbody>
            </table>

            {/* Lines */}
            <h6>Lines</h6>
            <table className="table table-bordered table-striped table-sm">
                <thead>
                <tr>
                    <th>SR / License #</th>
                    <th>Description</th>
                    <th>Mode</th>
                    <th className="text-end">Qty (Kg)</th>
                    <th className="text-end">Rate ₹/Kg</th>
                    <th className="text-end">CIF ₹</th>
                    <th className="text-end">FOB ₹</th>
                    <th className="text-end">%</th>
                    <th className="text-end">Amount ₹</th>
                </tr>
                </thead>
                <tbody>
                {lines.length ? (
                    lines.map((l, idx) => (
                        <tr key={l.id ?? idx}>
                            <td>
                                {cell(l?.sr_number?.license_number ?? l?.sr_number?.id ?? l?.sr_number)}
                            </td>
                            <td>{cell(l?.description)}</td>
                            <td>{cell(l?.mode)}</td>
                            <td className="text-end">{cell(l?.qty_kg)}</td>
                            <td className="text-end">{cell(l?.rate_inr_per_kg)}</td>
                            <td className="text-end">{cell(l?.cif_inr)}</td>
                            <td className="text-end">{cell(l?.fob_inr)}</td>
                            <td className="text-end">{cell(l?.pct)}</td>
                            <td className="text-end">{cell(l?.amount_inr)}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={9}>-</td>
                    </tr>
                )}
                </tbody>
            </table>

            {/* Payments */}
            <h6>Payments</h6>
            <table className="table table-bordered table-striped table-sm">
                <thead>
                <tr>
                    <th>Date</th>
                    <th className="text-end">Amount ₹</th>
                    <th>Note</th>
                </tr>
                </thead>
                <tbody>
                {payments.length ? (
                    payments.map((p, idx) => (
                        <tr key={p.id ?? idx}>
                            <td>{cell(p.date)}</td>
                            <td className="text-end">{cell(p.amount)}</td>
                            <td>{cell(p.note)}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={3}>-</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
};

export default TradeHtmlView;
