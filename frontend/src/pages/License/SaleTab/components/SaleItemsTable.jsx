// src/pages/License/sale/components/SaleItemsTable.jsx
import React from "react";
import {Button, Form, Table} from "react-bootstrap";

/**
 * @param {Object[]}  items
 * @param {"item"|"full"} saleType
 * @param {"kg"|"cif_inr"} billingMode   // used when saleType === "item"
 * @param {"cif_inr"|"fob_inr"} saleBasis // used when saleType === "full"
 * @param {{qty:number,cif_fc:number,cif_inr:number,fob_inr:number,amount:number}} totals
 * @param {(rowIndex:number, newRate:number|string)=>void} onRateChange
 * @param {(rowIndex:number)=>void} onRemoveRow
 * @param {(rowIndex:number, field:"cif_inr"|"fob_inr", value:number|string)=>void} [onFieldChange]
 */
export default function SaleItemsTable({
                                           items = [],
                                           saleType,
                                           billingMode,
                                           saleBasis,
                                           totals = {qty: 0, cif_fc: 0, cif_inr: 0, fob_inr: 0, amount: 0},
                                           onRateChange,
                                           onRemoveRow,
                                           onFieldChange, // <-- now accepted
                                       }) {
    const isFull = saleType === "full";
    const baseField = saleBasis === "fob_inr" ? "fob_inr" : "cif_inr";
    const baseHeader = saleBasis === "fob_inr" ? "FOB INR" : "CIF INR";

    const num = (v) => Number(v ?? 0);

    return (
        <Table bordered size="sm" className="align-middle">
            <thead className="table-light">
            <tr>
                <th style={{width: 56}}>#</th>
                <th>License</th>
                {isFull ? (
                    <>
                        <th style={{width: 180}}>{baseHeader}</th>
                        <th style={{width: 160}}>Billing %</th>
                        <th style={{width: 160}} className="text-end">
                            Amount ₹
                        </th>
                        <th style={{width: 60}}/>
                    </>
                ) : (
                    <>
                        <th style={{width: 200}}>
                            {billingMode === "kg" ? "Qty" : "CIF INR"}
                        </th>
                        <th style={{width: 160}}>
                            {billingMode === "kg" ? "Rate ₹/kg" : "Billing %"}
                        </th>
                        <th style={{width: 160}} className="text-end">
                            Amount ₹
                        </th>
                        <th style={{width: 60}}/>
                    </>
                )}
            </tr>
            </thead>

            <tbody>
            {(items || []).map((it, idx) => (
                <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{it.license_no}</td>

                    {isFull ? (
                        <>
                            {/* Editable Base (FOB/CIF) */}
                            <td>
                                <Form.Control
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    className="form-control form-control-sm"
                                    value={it[baseField] ?? 0}
                                    onChange={(e) =>
                                        onFieldChange?.(idx, baseField, e.target.value)
                                    }
                                    onWheel={(e) => e.currentTarget.blur()} // avoid scroll changing numbers
                                />
                            </td>

                            {/* Billing % */}
                            <td>
                                <Form.Control
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    className="form-control form-control-sm"
                                    value={it.rate ?? 0}
                                    onChange={(e) => onRateChange(idx, e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                />
                            </td>

                            {/* Amount */}
                            <td className="text-end">
                                {num(it.amount).toFixed(2)}
                            </td>

                            {/* (no remove in full mode) */}
                            <td/>
                        </>
                    ) : (
                        <>
                            {/* Qty or CIF (read-only here) */}
                            <td>
                                {billingMode === "kg"
                                    ? num(it.qty)
                                    : num(it.cif_inr).toFixed(2)}
                            </td>

                            {/* Rate / Billing % */}
                            <td>
                                <Form.Control
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    className="form-control form-control-sm"
                                    value={it.rate ?? 0}
                                    onChange={(e) => onRateChange(idx, e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                />
                            </td>

                            {/* Amount */}
                            <td className="text-end">
                                {num(it.amount).toFixed(2)}
                            </td>

                            {/* Remove row */}
                            <td className="text-center">
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => onRemoveRow(idx)}
                                    title="Remove row"
                                >
                                    ✖
                                </Button>
                            </td>
                        </>
                    )}
                </tr>
            ))}
            </tbody>

            <tfoot>
            <tr>
                <td colSpan={2}>
                    <strong>Total</strong>
                </td>

                {isFull ? (
                    <>
                        <td>
                            <strong>
                                {num(baseField === "fob_inr" ? totals.fob_inr : totals.cif_inr).toFixed(2)}
                            </strong>
                        </td>
                        <td/>
                        <td className="text-end">
                            <strong>{num(totals.amount).toFixed(2)}</strong>
                        </td>
                        <td/>
                    </>
                ) : (
                    <>
                        <td>
                            <strong>
                                {billingMode === "kg" ? num(totals.qty) : num(totals.cif_inr).toFixed(2)}
                            </strong>
                        </td>
                        <td/>
                        <td className="text-end">
                            <strong>{num(totals.amount).toFixed(2)}</strong>
                        </td>
                        <td/>
                    </>
                )}
            </tr>
            </tfoot>
        </Table>
    );
}
