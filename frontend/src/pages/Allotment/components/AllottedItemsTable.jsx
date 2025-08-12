import React from "react";
import {Button, Spinner, Table} from "react-bootstrap";
import {fmt, round2, roundQty, safeNum} from "./utils/number";

const AllottedItemsTable = ({items, deleting, onRemoveOne}) => {
    // Totals for footer
    const totals = (items || []).reduce(
        (acc, r) => {
            acc.qty += roundQty(r.qty);
            acc.cif += safeNum(r.cif_fc);
            return acc;
        },
        {qty: 0, cif: 0}
    );
    totals.cif = round2(totals.cif);

    return (
        <Table size="sm" bordered responsive className="mb-3">
            <thead className="table-light">
            <tr>
                <th style={{width: 40}}>#</th>
                <th>License Item (SR)</th>
                <th className="text-end" style={{width: 120}}>Qty</th>
                <th className="text-end" style={{width: 140}}>CIF $</th>
                <th style={{width: 110}}/>
            </tr>
            </thead>
            <tbody>
            {(items || []).length === 0 && (
                <tr>
                    <td colSpan={5} className="text-center text-muted">No items allotted yet</td>
                </tr>
            )}
            {(items || []).map((row, i) => {
                const isDel = row?.id ? !!deleting[row.id] : false;
                return (
                    <tr key={row.id || i}>
                        <td>{i + 1}</td>
                        <td>{row.sr_number?.label || "-"}</td>
                        <td className="text-end">{Number(roundQty(row.qty ?? 0)).toLocaleString("en-IN")}</td>
                        <td className="text-end">{fmt(row.cif_fc)}</td>
                        <td className="text-end">
                            <Button
                                size="sm"
                                variant="outline-danger"
                                disabled={isDel}
                                onClick={() => onRemoveOne(row, i)}
                            >
                                {isDel ? (
                                    <>
                                        <Spinner size="sm" className="me-1"/> Removing…
                                    </>
                                ) : (
                                    "Remove"
                                )}
                            </Button>
                        </td>
                    </tr>
                );
            })}
            </tbody>
            <tfoot>
            <tr className="table-light fw-semibold">
                <td colSpan={2} className="text-end">Total</td>
                <td className="text-end">{totals.qty}</td>
                <td className="text-end">{fmt(totals.cif)}</td>
                <td/>
            </tr>
            </tfoot>
        </Table>
    );
};

export default AllottedItemsTable;
