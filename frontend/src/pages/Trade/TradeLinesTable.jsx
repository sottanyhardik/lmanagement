// src/pages/Trade/TradeLinesTable.jsx
import React, {useCallback, useEffect, useMemo} from "react";
import {Button, Form, Table} from "react-bootstrap";
import {FaPlus, FaTrashAlt} from "react-icons/fa";
import axios from "../../api/axiosInstance";
import AsyncSrNumberSelect from "../../components/AsyncSelect/AsyncSrNumberSelect";

const MODES = [
    {value: "QTY", label: "Quantity (Kg × Rate)"},
    {value: "CIF_INR", label: "CIF (INR × %)"},
    {value: "FOB_INR", label: "FOB (INR × %)"},
];

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const asId = (opt) => (opt && typeof opt === "object" ? opt.id ?? opt.value ?? null : opt ?? null);

const normalizeSrOption = (value) =>
    value
        ? "value" in (value || {})
            ? value
            : {
                value: value.id ?? value.value,
                label: value.label ?? value.display_name ?? String(value.id ?? value.value ?? ""),
                id: value.id ?? value.value ?? undefined,
                data: value,
            }
        : null;

function computeBillAmount(r) {
    const mode = r.mode || "QTY";
    if (mode === "QTY") return num(r.qty_kg) * num(r.rate_inr_per_kg);
    if (mode === "CIF_INR") return num(r.cif_inr) * (num(r.pct) / 100);
    if (mode === "FOB_INR") return num(r.fob_inr) * (num(r.pct) / 100);
    return 0;
}

function syncCifTriad(row, src) {
    const cif_fc = num(row.cif_fc);
    const cif_inr = num(row.cif_inr);
    let exch = row.exch_rate === "" || row.exch_rate == null ? null : num(row.exch_rate);
    const hasRate = exch && exch > 0;

    if (src === "cif_fc" && hasRate) row.cif_inr = cif_fc * exch;
    else if (src === "cif_inr" && hasRate) row.cif_fc = exch > 0 ? cif_inr / exch : row.cif_fc;
    else if (src === "exch_rate" && hasRate) {
        if (cif_fc > 0) row.cif_inr = cif_fc * exch;
        else if (cif_inr > 0) row.cif_fc = exch > 0 ? cif_inr / exch : row.cif_fc;
    }

    if ((!exch || exch <= 0) && num(row.cif_fc) > 0 && num(row.cif_inr) > 0) {
        row.exch_rate = num(row.cif_inr) / num(row.cif_fc);
    }
    return row;
}

const TradeLinesTable = ({rows = [], setRows, onChange, direction, boeId = null, errors = {}}) => {
    const applyRows = useCallback(
        (next) => {
            if (typeof setRows === "function") return setRows(next);
            if (typeof onChange === "function") return onChange(next);
            console.warn("TradeLinesTable: no setRows/onChange handler provided.");
        },
        [setRows, onChange]
    );

    useEffect(() => {
        let cancelled = false;
        const prefillFromBOE = async () => {
            if (!boeId) return;
            try {
                const {data} = await axios.get(`bill-of-entries/${boeId}/`);
                const exHint = num(data?.exchange_rate);
                const items = data?.item_details || [];
                if (!Array.isArray(items) || !items.length) return;

                const mapped = items.map((it) => {
                    let cif_fc = num(it.cif_fc);
                    let cif_inr = num(it.cif_inr);
                    let exch = exHint > 0 ? exHint : cif_fc > 0 && cif_inr > 0 ? cif_inr / cif_fc : 0;
                    if (exch > 0) {
                        if (cif_fc > 0 && cif_inr <= 0) cif_inr = cif_fc * exch;
                        if (cif_inr > 0 && cif_fc <= 0) cif_fc = cif_inr / exch;
                    }
                    return {
                        id: undefined,
                        mode: "CIF_INR",
                        sr_number: normalizeSrOption(it.sr_number),
                        description: "",
                        qty_kg: num(it.qty).toString(),
                        rate_inr_per_kg: "0",
                        cif_fc: cif_fc ? cif_fc.toString() : "0",
                        exch_rate: exch > 0 ? exch.toFixed(4) : "",
                        cif_inr: cif_inr ? cif_inr.toString() : "0",
                        fob_inr: "0",
                        pct: "0",
                        amount_inr: 0,
                    };
                });

                mapped.forEach((r) => (r.amount_inr = computeBillAmount(r)));
                if (!cancelled) applyRows(mapped);
            } catch {
                /* ignore */
            }
        };
        prefillFromBOE();
        return () => {
            cancelled = true;
        };
    }, [boeId, applyRows]);

    const updateRow = useCallback(
        (i, patch, src = null) => {
            const next = [...rows];
            const row = {...(next[i] || {}), ...patch};
            if ("sr_number" in patch) row.sr_number = normalizeSrOption(patch.sr_number);
            if (["cif_fc", "cif_inr", "exch_rate"].includes(src)) syncCifTriad(row, src);
            row.amount_inr = computeBillAmount(row);
            next[i] = row;
            applyRows(next);
        },
        [rows, applyRows]
    );

    const add = useCallback(() => {
        applyRows([
            ...rows,
            {
                mode: "QTY",
                qty_kg: "0",
                rate_inr_per_kg: "0",
                cif_fc: "0",
                exch_rate: "",
                cif_inr: "0",
                fob_inr: "0",
                pct: "0",
                description: "",
                sr_number: null,
                amount_inr: 0,
            },
        ]);
    }, [rows, applyRows]);

    const remove = useCallback(
        (i) => {
            const next = [...rows];
            next.splice(i, 1);
            applyRows(next);
        },
        [rows, applyRows]
    );

    const getErr = (i, key) => errors?.[`lines.${i}.${key}`] || "";
    const invalidCls = (has) => (has ? "is-invalid" : "");

    const onSrSelected = useCallback(
        async (i, option) => {
            const normalized = normalizeSrOption(option);
            updateRow(i, {sr_number: normalized});
            if (boeId) return;

            const id = asId(normalized);
            if (!id) return;

            let item = normalized?.data;
            if (!item) {
                try {
                    const {data} = await axios.get(`license-import-items/${id}/`);
                    item = data || null;
                } catch {
                    item = null;
                }
            }
            if (!item) return;

            const patch = {};
            if (item.available_quantity != null) patch.qty_kg = String(num(item.available_quantity));
            if (item.license_cif_fc_total != null) patch.cif_fc = String(num(item.license_cif_fc_total));
            if (item.license_cif_inr_total != null) patch.cif_inr = String(num(item.license_cif_inr_total));
            if (item.license_fob_inr_total != null) patch.fob_inr = String(num(item.license_fob_inr_total));
            if (item.exchange_rate_hint != null) patch.exch_rate = String(num(item.exchange_rate_hint));
            if (patch.cif_fc || patch.cif_inr) patch.mode = "CIF_INR";
            updateRow(i, patch);
        },
        [boeId, updateRow]
    );

    const totals = useMemo(() => {
        const acc = {qty: 0, cif_fc: 0, cif_inr: 0, fob_inr: 0, bill: 0};
        (rows || []).forEach((r) => {
            acc.qty += num(r.qty_kg);
            acc.cif_fc += num(r.cif_fc);
            acc.cif_inr += num(r.cif_inr);
            acc.fob_inr += num(r.fob_inr);
            acc.bill += computeBillAmount(r);
        });
        const nearest = Math.round(acc.bill);
        const roundoff = nearest - acc.bill;
        return {...acc, roundoff, final: nearest};
    }, [rows]);

    const showQtyCols = (r) => (r.mode || "QTY") === "QTY";
    const showValueCols = (r) => ["CIF_INR", "FOB_INR"].includes(r.mode || "QTY");

    return (
        <>
            <Table size="sm" bordered responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{minWidth: 240}}>License Sr</th>
                    <th>Description</th>
                    <th style={{width: 180}}>Mode</th>
                    <th className="text-end">Qty (Kg)</th>
                    <th className="text-end">Rate ₹/Kg</th>
                    <th className="text-end">CIF $</th>
                    <th className="text-end">Exch. Rate</th>
                    <th className="text-end">CIF ₹</th>
                    <th className="text-end">FOB ₹</th>
                    <th className="text-end">Rate %</th>
                    <th className="text-end">Bill Amount ₹</th>
                    <th style={{width: 90}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {(rows || []).map((r, i) => {
                    const errSr = getErr(i, "sr_number");
                    const mode = r.mode || "QTY";
                    return (
                        <tr key={r.id ?? i}>
                            <td>
                                <div className={invalidCls(!!errSr)}>
                                    <AsyncSrNumberSelect
                                        classNamePrefix="react-select"
                                        value={normalizeSrOption(r.sr_number)}
                                        onChange={(v) => onSrSelected(i, v)}
                                        placeholder="Search import item (SR)…"
                                    />
                                </div>
                                {errSr && <div className="invalid-feedback d-block">{errSr}</div>}
                            </td>

                            <td>
                                <Form.Control
                                    size="sm"
                                    value={r.description || ""}
                                    onChange={(e) => updateRow(i, {description: e.target.value})}
                                />
                            </td>

                            <td>
                                <Form.Select size="sm" value={mode}
                                             onChange={(e) => updateRow(i, {mode: e.target.value})}>
                                    {MODES.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            </td>

                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={r.qty_kg || "0"}
                                    onChange={(e) => updateRow(i, {qty_kg: e.target.value})}
                                    step="0.0001"
                                    min="0"
                                    disabled={!showQtyCols(r)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={r.rate_inr_per_kg || "0"}
                                    onChange={(e) => updateRow(i, {rate_inr_per_kg: e.target.value})}
                                    step="0.01"
                                    min="0"
                                    disabled={!showQtyCols(r)}
                                />
                            </td>

                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={r.cif_fc || "0"}
                                    onChange={(e) => updateRow(i, {cif_fc: e.target.value}, "cif_fc")}
                                    step="0.0001"
                                    min="0"
                                    disabled={!showValueCols(r)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    placeholder="auto"
                                    value={r.exch_rate ?? ""}
                                    onChange={(e) => updateRow(i, {exch_rate: e.target.value}, "exch_rate")}
                                    step="0.0001"
                                    min="0"
                                    disabled={!showValueCols(r)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={r.cif_inr || "0"}
                                    onChange={(e) => updateRow(i, {cif_inr: e.target.value}, "cif_inr")}
                                    step="0.01"
                                    min="0"
                                    disabled={!showValueCols(r)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={r.fob_inr || "0"}
                                    onChange={(e) => updateRow(i, {fob_inr: e.target.value})}
                                    step="0.01"
                                    min="0"
                                    disabled={!showValueCols(r)}
                                />
                            </td>
                            <td>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    className="text-end"
                                    value={r.pct || "0"}
                                    onChange={(e) => updateRow(i, {pct: e.target.value})}
                                    step="0.001"
                                    min="0"
                                    disabled={!showValueCols(r)}
                                />
                            </td>

                            <td className="text-end">{computeBillAmount(r).toFixed(2)}</td>

                            <td className="text-center">
                                <Button type="button" size="sm" variant="outline-danger" onClick={() => remove(i)}
                                        title="Remove line">
                                    <FaTrashAlt/>
                                </Button>
                            </td>
                        </tr>
                    );
                })}

                {!rows?.length && (
                    <tr>
                        <td colSpan={12} className="text-center text-muted py-3">
                            No lines yet.
                        </td>
                    </tr>
                )}
                </tbody>
            </Table>

            <div className="d-flex justify-content-between align-items-center">
                <Button type="button" size="sm" variant="primary" onClick={add}>
                    <FaPlus className="me-1"/> Add Line
                </Button>

                <div className="text-end small">
                    <div>
                        <strong>Totals</strong> — Qty: <strong>{totals.qty.toFixed(4)}</strong>
                        {"  "} | CIF $: <strong>{totals.cif_fc.toFixed(4)}</strong>
                        {"  "} | CIF ₹: <strong>{totals.cif_inr.toFixed(2)}</strong>
                        {"  "} | FOB ₹: <strong>{totals.fob_inr.toFixed(2)}</strong>
                        {"  "} | Bill ₹: <strong>{totals.bill.toFixed(2)}</strong>
                    </div>
                    <div>
                        Round-off: <strong>{totals.roundoff >= 0 ? "+" : ""}{totals.roundoff.toFixed(2)}</strong>
                        {"  "} → Final Bill: <strong>₹ {totals.final.toFixed(2)}</strong>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TradeLinesTable;
