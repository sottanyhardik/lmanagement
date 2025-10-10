// src/components/trade/TradeInvoiceCore.jsx
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, Col, Row, Spinner, Tab, Tabs} from "react-bootstrap";
import axios from "../../api/axiosInstance";
import {toast} from "react-toastify";

import HeaderTab from "../../pages/Trade/form/tabs/HeaderTab";
import LinesTab from "../../pages/Trade/form/tabs/LinesTab";
import TradePaymentsTable from "../../pages/Trade/TradePaymentsTable";
import TotalsInline from "../../pages/Trade/components/TotalsInline";

import {emptyTrade} from "../../pages/Trade/form/tabs/helpers";

/**
 * TradeInvoiceCore
 *
 * Props:
 *  - mode = "PURCHASE" | "SALE"
 *  - boe = object|null
 *  - initialTrade = object|null
 *  - fetchByBoe = boolean
 *  - onSaved = function(saved)
 *  - onClose = function()
 *  - initialActiveTab = "trade" | "lines" | "payments" | "totals"  (optional)
 *
 * Notes:
 *  - initialActiveTab controls which tab is active when the editor mounts or when initialTrade changes.
 */
export default function TradeInvoiceCore({
    mode = "PURCHASE",
    boe = null,
    initialTrade = null,
    fetchByBoe = false,
    onSaved = null,
    onClose = null,
    initialActiveTab = "trade",
}) {
    const [form, setForm] = useState(() => ({...emptyTrade, direction: mode, boe: boe ?? null}));
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(initialActiveTab);

    // keep direction aligned unless user changes it via HeaderTab
    useEffect(() => {
        setForm((prev) => ({...prev, direction: mode}));
    }, [mode]);

    // Replace local form completely when initialTrade changes.
    useEffect(() => {
        if (initialTrade && typeof initialTrade === "object") {
            // editing: clone the provided trade so we don't mutate parent's object
            setForm(() => ({...initialTrade}));
            setErrors({});
        } else {
            // new trade: clean state — apply boe only if prop present (do NOT preserve previous boe/id)
            setForm(() => ({...emptyTrade, direction: mode, boe: boe ?? null}));
            setErrors({});
        }

        // reset active tab to requested tab when the trade changes (keeps consistent UX)
        setActiveTab(initialActiveTab || "trade");
    }, [initialTrade, mode, initialActiveTab]); // include initialActiveTab so parent can control which tab opens

    // If creating a new trade (no id) and boe prop changes later, apply it.
    useEffect(() => {
        const hasId = Boolean(initialTrade?.id || form?.id);
        if (!hasId) {
            setForm((prev) => ({...prev, boe: boe ?? null}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boe]);

    // If fetchByBoe requested and boe present for a new trade, keep it so LinesTab can prefill
    useEffect(() => {
        if (fetchByBoe && boe && !form?.id) {
            setForm((prev) => ({...prev, boe}));
        }
    }, [fetchByBoe, boe, form?.id]);

    const setField = useCallback((key, val) => {
        setForm((prev) => ({...prev, [key]: val}));
    }, []);

    const setLines = useCallback((lines) => {
        setForm((prev) => ({...prev, lines}));
    }, []);

    const setPaymentsLocal = useCallback((payments) => {
        setForm((prev) => ({...prev, payments}));
    }, []);

    const isEdit = useMemo(() => !!form?.id, [form?.id]);

    const handleSave = async () => {
        setLoading(true);
        setErrors({});
        try {
            const payload = {...form};

            let resp;
            if (isEdit) {
                resp = await axios.patch(`trades/${form.id}/`, payload);
                toast.success("Trade updated");
            } else {
                resp = await axios.post("trades/", payload);
                toast.success("Trade created");
            }

            const saved = resp?.data ?? null;
            if (saved) {
                // replace local form with canonical server object
                setForm(() => ({...saved}));
            }

            if (typeof onSaved === "function") {
                try {
                    onSaved(saved);
                } catch (e) {
                    // swallow parent callback errors
                }
            }

            setActiveTab("trade");
            return saved;
        } catch (err) {
            const data = err?.response?.data;
            if (data && typeof data === "object") {
                setErrors(data);
                if (data?.detail) toast.error(String(data.detail));
                else toast.error("Failed to save. Check validation errors.");
            } else {
                toast.error(err?.message || "Failed to save trade");
            }
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (typeof onClose === "function") onClose();
    };

    return (
        <div>
            <div className="mb-2 d-flex justify-content-between align-items-start">
                <div>
                    <h5 className="mb-1">
                        {isEdit ? (form.direction === "SALE" ? "Edit Sale" : "Edit Purchase") : (form.direction === "SALE" ? "New Sale" : "New Purchase")}
                    </h5>
                    <div className="text-muted small">
                        {isEdit ? `Editing #${form.id}` : "Fill details and click Save"}
                    </div>
                </div>

                <div className="d-flex gap-2 align-items-center">
                    <Button size="sm" variant="secondary" onClick={() => setActiveTab("trade")}>Header</Button>
                    <Button size="sm" variant="secondary" onClick={() => setActiveTab("lines")}>Lines</Button>
                    <Button size="sm" variant="secondary" onClick={() => setActiveTab("payments")}>Payments</Button>
                    <Button size="sm" variant="secondary" onClick={() => setActiveTab("totals")}>Totals</Button>

                    <div className="d-flex align-items-center ms-2">
                        <Button size="sm" variant="primary" onClick={handleSave} disabled={loading}>
                            {loading ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                    Saving…
                                </>
                            ) : (
                                isEdit ? "Save" : "Create"
                            )}
                        </Button>

                        {typeof onClose === "function" && (
                            <Button size="sm" variant="outline-secondary" onClick={handleCancel} className="ms-2">
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3" mountOnEnter unmountOnExit={false}>
                <Tab eventKey="trade" title="📄 Trade">
                    <HeaderTab data={form} errors={errors} setField={setField} />
                </Tab>

                <Tab eventKey="lines" title="🧾 Lines">
                    <LinesTab
                        rows={form.lines || []}
                        setRows={setLines}
                        direction={form.direction}
                        boeId={form?.boe?.id ?? form?.boe?.value ?? null}
                        errors={errors}
                    />
                </Tab>

                <Tab eventKey="payments" title="💸 Payments">
                    <TradePaymentsTable
                        tradeId={form?.id ?? null}
                        rows={form.payments || []}
                        onChange={setPaymentsLocal}
                        onAfterServerChange={async () => {
                            if (!form?.id) return;
                            try {
                                setLoading(true);
                                const {data} = await axios.get(`trades/${form.id}/`);
                                setForm(() => ({...data}));
                            } catch {
                                // ignore
                            } finally {
                                setLoading(false);
                            }
                        }}
                    />
                </Tab>

                <Tab eventKey="totals" title="🧮 Totals">
                    <TotalsInline entry={form} />
                </Tab>
            </Tabs>

            {errors && Object.keys(errors).length > 0 && (
                <Row className="mt-2">
                    <Col>
                        <div className="alert alert-warning py-2 small mb-0">
                            Form has validation errors. Please review highlighted fields.
                        </div>
                    </Col>
                </Row>
            )}
        </div>
    );
}
