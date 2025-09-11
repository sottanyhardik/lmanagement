// src/pages/Trade/TradeForm.jsx
import React, {useEffect, useState} from "react";
import {Button, Tab, Tabs} from "react-bootstrap";
import axios from "../../api/axiosInstance";
import {toast} from "react-toastify";

import HeaderTab from "./form/tabs/HeaderTab";
import LinesTab from "./form/tabs/LinesTab";
import {asId, emptyTrade} from "./form/helpers";

const TradeForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [data, setData] = useState({...(entry || emptyTrade)});
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [activeTab, setActiveTab] = useState("header"); // "header" | "lines"

    // Load incoming entry into local state
    useEffect(() => {
        if (entry) setData({...emptyTrade, ...(entry || {})});
    }, [entry]);

    // If switching to PURCHASE, clear BOE (BOE is SALE-only)
    useEffect(() => {
        if (data.direction === "PURCHASE" && data.boe) {
            setData((prev) => ({...prev, boe: null}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.direction]);

    const setField = (k, v) => setData((prev) => ({...prev, [k]: v}));

    const buildPayload = () => ({
        direction: data.direction,
        invoice_number: data.invoice_number, // purchase can be blank; sale can be auto-suggested/edited
        invoice_date: data.invoice_date || null,
        remarks: data.remarks,

        from_company_id: data.from_company ? asId(data.from_company) : null,
        to_company_id: data.to_company ? asId(data.to_company) : null,

        // snapshots (editable)
        from_pan: data.from_pan || "",
        from_gst: data.from_gst || "",
        from_addr_line_1: data.from_addr_line_1 || "",
        from_addr_line_2: data.from_addr_line_2 || "",
        to_pan: data.to_pan || "",
        to_gst: data.to_gst || "",
        to_addr_line_1: data.to_addr_line_1 || "",
        to_addr_line_2: data.to_addr_line_2 || "",

        // only send BOE for SALE
        boe: data.direction === "SALE" && data.boe ? asId(data.boe) : null,

        // lines (normalize sr_number to id for write)
        lines: (data.lines || []).map((l) => ({
            id: l.id,
            sr_number: l.sr_number ? asId(l.sr_number) : null,
            description: l.description || "",
            mode: l.mode || "QTY",
            qty_kg: l.qty_kg || "0",
            rate_inr_per_kg: l.rate_inr_per_kg || "0",
            cif_inr: l.cif_inr || "0",
            fob_inr: l.fob_inr || "0",
            pct: l.pct || "0",
        })),
    });

    const save = async () => {
        const payload = buildPayload();
        setSaving(true);
        try {
            let resp;
            if (isNew || !data.id) {
                resp = await axios.post("trades/", payload);
                toast.success("Trade created");
            } else {
                resp = await axios.patch(`trades/${data.id}/`, payload);
                toast.success("Trade updated");
            }

            // keep local copy in sync (id needed for uploads, payments, etc.)
            const updated = resp.data || {};
            setData((prev) => ({...prev, ...updated}));

            // bubble up if caller wants to refresh
            onSaved?.(updated.id, updated);

            return updated;
        } catch (err) {
            const apiErrors = err?.response?.data || {};
            setErrors(apiErrors);
            toast.error(apiErrors?.detail || "Failed to save trade");
            return null;
        } finally {
            setSaving(false);
        }
    };

    // Wizard behavior:
    // - On Main tab: "Save & Continue → Items" (moves to Item List on success)
    // - On Item List: "Save Trade" (stays on current tab)
    const handleSaveHeaderThenNext = async () => {
        const updated = await save();
        if (updated) setActiveTab("lines");
    };

    const handleSaveStay = async () => {
        await save();
    };

    return (
        <div>
            <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k || "header")}
                className="mb-3"
            >
                <Tab eventKey="header" title="Main">
                    <HeaderTab data={data} errors={errors} setField={setField}/>
                </Tab>

                <Tab eventKey="lines" title={`Item List (${data.lines?.length || 0})`}>
                    <LinesTab
                        rows={data.lines}
                        setRows={(rows) => setField("lines", rows)}
                        direction={data.direction}
                        boeId={asId(data.boe)}
                        errors={errors}
                    />
                </Tab>
            </Tabs>

            <div className="mt-3 d-flex align-items-center">
                {activeTab === "header" ? (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveHeaderThenNext}
                        disabled={saving}
                        title="Save the header and continue to Item List"
                    >
                        {saving ? "Saving…" : "Save & Continue → Items"}
                    </Button>
                ) : (
                    <Button
                        variant="success"
                        size="sm"
                        onClick={handleSaveStay}
                        disabled={saving}
                        title="Save trade"
                    >
                        {saving ? "Saving…" : "Save Trade"}
                    </Button>
                )}

                {onClose && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="ms-2"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
};

export default TradeForm;
