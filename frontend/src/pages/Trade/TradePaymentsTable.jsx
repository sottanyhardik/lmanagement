import React, {useEffect, useMemo, useState} from "react";
import {Button, Form, Table} from "react-bootstrap";
import {FaPlus, FaSave, FaTrash} from "react-icons/fa";
import {toast} from "react-toastify";
import axios from "../../api/axiosInstance";

const todayISO = () => new Date().toISOString().slice(0, 10);
const n2 = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};
const fmt2 = (v) =>
    Number(v || 0).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});

/**
 * TradePaymentsTable
 * - If tradeId present: CRUD via /trade-payments/ API
 * - If no tradeId: edits are local (for new trades before save)
 *
 * Props:
 *   tradeId?: number
 *   rows?: array
 *   onChange?: (rows) => void
 *   onAfterServerChange?: () => void   // notify parent to refresh entry totals
 */
export default function TradePaymentsTable({rows = [], onChange, tradeId, onAfterServerChange}) {
    const [items, setItems] = useState(rows || []);
    const [loading, setLoading] = useState(false);

    const [newDate, setNewDate] = useState(todayISO());
    const [newAmount, setNewAmount] = useState("");
    const [newNote, setNewNote] = useState("");

    const refetch = async () => {
        if (!tradeId) return;
        try {
            setLoading(true);
            const {data} = await axios.get("trade-payments/", {params: {trade: tradeId}});
            const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
            setItems(list);
            onChange?.(list);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setItems(Array.isArray(rows) ? rows : []);
    }, [rows]);

    useEffect(() => {
        refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tradeId]);

    const totals = useMemo(() => ({sum: items.reduce((a, it) => a + n2(it.amount), 0)}), [items]);

    const pushLocal = (payload) => {
        const next = [...items, payload];
        setItems(next);
        onChange?.(next);
    };

    const updateLocal = (i, patch) => {
        const next = [...items];
        next[i] = {...next[i], ...patch};
        setItems(next);
        onChange?.(next);
    };

    const removeLocal = (i) => {
        const next = [...items];
        next.splice(i, 1);
        setItems(next);
        onChange?.(next);
    };

    const handleAdd = async () => {
        const amt = n2(newAmount);
        if (amt <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        const payload = {
            date: newDate || todayISO(),
            amount: String(amt.toFixed(2)),
            note: newNote || "",
        };

        if (!tradeId) {
            pushLocal({...payload, id: `tmp-${Date.now()}`});
            setNewAmount("");
            setNewNote("");
            return;
        }

        try {
            setLoading(true);
            await axios.post("trade-payments/", {...payload, trade_id: tradeId});
            toast.success("Payment added");
            await refetch();
            onAfterServerChange?.(); // refresh parent entry
            setNewAmount("");
            setNewNote("");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to add payment");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (i) => {
        const row = items[i];
        if (!row) return;

        if (!tradeId || !row.id || String(row.id).startsWith("tmp-")) {
            updateLocal(i, row);
            toast.success("Updated");
            return;
        }

        try {
            setLoading(true);
            await axios.patch(`trade-payments/${row.id}/`, {
                date: row.date,
                amount: String(n2(row.amount).toFixed(2)),
                note: row.note || "",
            });
            toast.success("Updated");
            await refetch();
            onAfterServerChange?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to update");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (i) => {
        const row = items[i];
        if (!row) return;

        if (!tradeId || !row.id || String(row.id).startsWith("tmp-")) {
            removeLocal(i);
            return;
        }

        try {
            setLoading(true);
            await axios.delete(`trade-payments/${row.id}/`);
            toast.success("Deleted");
            await refetch();
            onAfterServerChange?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed to delete");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Table size="sm" bordered responsive className="align-middle">
                <thead className="table-light">
                <tr>
                    <th style={{width: 140}}>Date</th>
                    <th className="text-end" style={{width: 160}}>Amount ₹</th>
                    <th>Note</th>
                    <th style={{width: 150}} className="text-center">Actions</th>
                </tr>
                </thead>
                <tbody>
                {(items || []).map((p, i) => (
                    <tr key={p.id ?? i}>
                        <td>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={p.date || ""}
                                onChange={(e) => updateLocal(i, {date: e.target.value})}
                            />
                        </td>
                        <td>
                            <Form.Control
                                type="number"
                                size="sm"
                                className="text-end"
                                value={p.amount ?? ""}
                                onChange={(e) => updateLocal(i, {amount: e.target.value})}
                                step="0.01"
                                min="0"
                            />
                        </td>
                        <td>
                            <Form.Control
                                size="sm"
                                value={p.note || ""}
                                onChange={(e) => updateLocal(i, {note: e.target.value})}
                            />
                        </td>
                        <td className="text-center">
                            <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-2"
                                onClick={() => handleUpdate(i)}
                                disabled={loading}
                                title="Save"
                            >
                                <FaSave/>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDelete(i)}
                                disabled={loading}
                                title="Delete"
                            >
                                <FaTrash/>
                            </Button>
                        </td>
                    </tr>
                ))}

                {/* Add row */}
                <tr>
                    <td>
                        <Form.Control
                            type="date"
                            size="sm"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                        />
                    </td>
                    <td>
                        <Form.Control
                            type="number"
                            size="sm"
                            className="text-end"
                            value={newAmount}
                            onChange={(e) => setNewAmount(e.target.value)}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                        />
                    </td>
                    <td>
                        <Form.Control
                            size="sm"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Note"
                        />
                    </td>
                    <td className="text-center">
                        <Button
                            size="sm"
                            variant="success"
                            onClick={handleAdd}
                            disabled={loading}
                            title="Add"
                        >
                            <FaPlus/>
                        </Button>
                    </td>
                </tr>

                {!items?.length && (
                    <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                            No payments yet.
                        </td>
                    </tr>
                )}
                </tbody>

                <tfoot>
                <tr>
                    <th colSpan={1} className="text-end">Total</th>
                    <th className="text-end">₹ {fmt2(totals.sum)}</th>
                    <th colSpan={2}></th>
                </tr>
                </tfoot>
            </Table>
        </div>
    );
}
