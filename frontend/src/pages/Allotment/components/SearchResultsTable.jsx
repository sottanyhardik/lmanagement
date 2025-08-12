import React from "react";
import {Button, Form, Spinner, Table} from "react-bootstrap";
import {fmt, round2, roundQty, safeNum} from "./utils/number";

const SearchResultsTable = ({
                                results,
                                inputs,
                                setInput,
                                price,
                                posting,
                                loading,
                                page,
                                pageSize,
                                onAllotRow,
                            }) => (
    <Table size="sm" bordered responsive className="mb-2">
        <thead className="table-light">
        <tr>
            <th style={{width: 40}}>#</th>
            <th>License / SR</th>
            <th style={{width: 110}} className="text-end">HSN</th>
            <th className="text-start">Description</th>
            <th className="text-start">Notf-No</th>
            <th style={{width: 130}} className="text-end">Available Qty</th>
            <th style={{width: 130}} className="text-end">Available $</th>
            <th style={{width: 120}} className="text-end">Allot Qty</th>
            <th style={{width: 140}} className="text-end">Allot $</th>
            <th style={{width: 120}}/>
        </tr>
        </thead>
        <tbody>
        {results.length === 0 && !loading && (
            <tr>
                <td colSpan={10} className="text-center text-muted">No license items match your filters</td>
            </tr>
        )}
        {results.map((r, idx) => {
            const inpt = inputs[r.id] || {qty: "", cif_fc: ""};
            const availVal = safeNum(r.available_value);
            const availQty = roundQty(r.available_quantity);

            return (
                <tr key={r.id}>
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>{r.display_name}</td>
                    <td className="text-end">{r.hs_code}</td>
                    <td className="text-start">{r.description}</td>
                    <td className="text-start">{r.notification_number || "-"}</td>
                    <td className="text-end">{availQty}</td>
                    <td className="text-end">{fmt(r.available_value)}</td>

                    {/* Allot Qty (integer) */}
                    <td>
                        <Form.Control
                            size="sm"
                            className="text-end"
                            value={inpt.qty ?? ""}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setInput(r.id, "qty", raw);
                                if (price <= 0) return;

                                const typedQty = roundQty(raw);

                                const maxByVal =
                                    Number.isFinite(availVal) && availVal > 0 && price > 0
                                        ? roundQty(availVal / price)
                                        : Infinity;
                                const maxByQty = Number.isFinite(availQty) && availQty > 0 ? availQty : Infinity;

                                let finalQty = typedQty;
                                if (Number.isFinite(maxByVal)) finalQty = Math.min(finalQty, maxByVal);
                                if (Number.isFinite(maxByQty)) finalQty = Math.min(finalQty, maxByQty);

                                setInput(r.id, "qty", String(finalQty));
                                setInput(r.id, "cif_fc", String(round2(finalQty * price)));
                            }}
                        />
                    </td>

                    {/* Allot $ (derived if unit price known) */}
                    <td>
                        <Form.Control
                            size="sm"
                            className="text-end"
                            value={price > 0 ? String(round2(roundQty(inpt.qty) * price)) : inpt.cif_fc ?? ""}
                            readOnly={price > 0}
                            onChange={(e) => {
                                if (price > 0) return;
                                setInput(r.id, "cif_fc", e.target.value);
                            }}
                        />
                    </td>

                    <td className="text-end">
                        <Button
                            size="sm"
                            variant="success"
                            disabled={!!posting[r.id]}
                            onClick={() => onAllotRow(r)}
                        >
                            {posting[r.id] ? (
                                <>
                                    <Spinner size="sm" className="me-1"/> Allotting…
                                </>
                            ) : (
                                "Allot"
                            )}
                        </Button>
                    </td>
                </tr>
            );
        })}
        {loading && (
            <tr>
                <td colSpan={10} className="text-center text-muted">
                    <Spinner size="sm"/> Loading…
                </td>
            </tr>
        )}
        </tbody>
    </Table>
);

export default SearchResultsTable;
