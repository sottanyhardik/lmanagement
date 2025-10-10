// src/pages/Allotment/forms/AllotmentWizard.jsx
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Card, Spinner, Tab, Tabs} from "react-bootstrap";
import axios from "../../../api/axiosInstance";
import {toast} from "react-toastify";

import AllotmentLineItemTable from "../components/AllotmentLineItemTable.jsx";
import AllotmentForm from "../forms/AllotmentForm";
import AllotmentTLTab from "../panels/AllotmentTLTab"

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const roundQty = (n) => Math.max(0, Math.floor(safeNum(n)));
const round2 = (n) => Number(safeNum(n).toFixed(2));
const EPS = 0.01; // tiny tolerance for rounding

// normalize existing server lines for the table
const normalizeLines = (entry) =>
    (entry?.allotment_details || []).map((d) => ({
        id: d.id || null,
        sr_number: d.item
            ? {value: d.item.id, label: d.item.display_name}
            : {value: null, label: ""},
        qty: d.qty ?? 0,
        cif_fc: d.cif_fc ?? 0,
        cif_inr: d.cif_inr ?? 0,
        is_boe: !!d.is_boe,
        delete_url: d.delete_url,
    }));

export default function AllotmentWizard({allotmentId: initialId}) {
    const [activeKey, setActiveKey] = useState(initialId ? "allot" : "create");
    const [entry, setEntry] = useState(null);
    const [loadingEntry, setLoadingEntry] = useState(!!initialId);

    const loadEntry = useCallback(async (id) => {
        if (!id) return;
        setLoadingEntry(true);
        try {
            const {data} = await axios.get(`allotments/${id}/`);
            setEntry(data);
        } catch {
            toast.error("Failed to load allotment");
        } finally {
            setLoadingEntry(false);
        }
    }, []);

    useEffect(() => {
        if (initialId) loadEntry(initialId);
    }, [initialId, loadEntry]);

    // ------- Tab 1: Create -------
    const [createSaving, setCreateSaving] = useState(false);
    const [form, setForm] = useState({
        company_id: "",
        port_id: "",
        item_name: "",
        required_quantity: "",
        unit_value_per_unit: "",
        exchange_rate: "",
        required_cif_fc: "",
        invoice: "",
        estimated_arrival_date: "",
        bl_detail: "",
    });

    const handleCreateChange = (k, v) => setForm((p) => ({...p, [k]: v}));

    const unitPriceFromState = safeNum(entry?.unit_value_per_unit || form.unit_value_per_unit);
    const reqQtyFromState = roundQty(entry?.required_quantity ?? form.required_quantity);

    const derivedRequired$ = useMemo(
        () =>
            round2(
                entry?.required_cif_fc != null && entry?.required_cif_fc !== ""
                    ? entry.required_cif_fc
                    : reqQtyFromState * unitPriceFromState
            ),
        [entry?.required_cif_fc, reqQtyFromState, unitPriceFromState]
    );

    const onCreateSubmit = async (e) => {
        e?.preventDefault?.();
        const unitPrice = safeNum(form.unit_value_per_unit);
        const reqQty = roundQty(form.required_quantity);

        if (!form.company_id) return toast.warn("Company is required");
        if (!form.item_name.trim()) return toast.warn("Item name is required");
        if (reqQty <= 0) return toast.warn("Required quantity must be > 0");
        if (unitPrice <= 0) return toast.warn("Unit price must be > 0");

        const payload = {
            company_id: form.company_id || null,
            port_id: form.port_id || null,
            item_name: form.item_name || "",
            required_quantity: reqQty,
            unit_value_per_unit: unitPrice,
            exchange_rate: form.exchange_rate ? safeNum(form.exchange_rate) : null,
            required_cif_fc:
                form.required_cif_fc !== "" ? safeNum(form.required_cif_fc) : round2(reqQty * unitPrice),
            invoice: form.invoice || "",
            estimated_arrival_date: form.estimated_arrival_date || null,
            bl_detail: form.bl_detail || "",
        };

        setCreateSaving(true);
        try {
            const {data} = await axios.post("allotments/", payload);
            setEntry(data);
            toast.success("Allotment created");
            setActiveKey("allot");
        } catch (err) {
            const apiErrors = err.response?.data;
            if (apiErrors && typeof apiErrors === "object") {
                const first = Object.values(apiErrors)[0];
                toast.error(Array.isArray(first) ? first.join(", ") : String(first));
            } else {
                toast.error("Failed to create allotment");
            }
        } finally {
            setCreateSaving(false);
        }
    };

    // ------- Tab 2: Make Allotment -------
    const [items, setItems] = useState([]);
    const refreshFromServer = useCallback(() => {
        if (entry?.id) loadEntry(entry.id);
    }, [entry?.id, loadEntry]);

    useEffect(() => {
        setItems(normalizeLines(entry));
    }, [entry?.id, entry?.allotment_details]);

    const onRemoveRow = (idx) => {
        setItems((prev) => {
            const next = [...prev];
            next.splice(idx, 1);
            return next.length ? next : [];
        });
    };

    // current totals from server lines
    const currentTotals = useMemo(() => {
        const lines = entry?.allotment_details || [];
        const tQty = lines.reduce((s, r) => s + roundQty(r.qty), 0);
        const tFC = lines.reduce((s, r) => s + safeNum(r.cif_fc), 0);
        return {tQty, tFC: round2(tFC)};
    }, [entry?.id, entry?.allotment_details]);

    // remaining caps with tiny tolerance to avoid 2dp collisions
    const remaining = useMemo(() => {
        const rQty = Math.max(0, reqQtyFromState - currentTotals.tQty);
        const rFC = Math.max(0, round2(derivedRequired$ - currentTotals.tFC - EPS));
        return {rQty, rFC};
    }, [reqQtyFromState, derivedRequired$, currentTotals]);

    // ------- Tab 3: Make TL -------
    const [tlSaving, setTlSaving] = useState(false);
    const [tlForm, setTlForm] = useState({
        to_company: "",
        remarks: "",
    });

    const submitTL = async () => {
        if (!entry?.id) return toast.warn("Create & save the allotment first");
        setTlSaving(true);
        try {
            await axios.post(`allotments/${entry.id}/transfer-letter/`, {
                to_company: tlForm.to_company || null,
                remarks: tlForm.remarks || "",
            });
            toast.success("Transfer Letter created");
        } catch {
            toast.error("Failed to create Transfer Letter");
        } finally {
            setTlSaving(false);
        }
    };

    const chip = (label, value, variant = "secondary") => (
        <span className={`badge bg-${variant} me-2`} style={{fontSize: "0.85rem"}}>
      {label}: {value}
    </span>
    );

    const headerChips = () => {
        const reqQ = reqQtyFromState;
        const req$ = derivedRequired$;
        const allotedQty = (entry?.allotment_details || []).reduce((s, r) => s + roundQty(r.qty), 0);
        const alloted$ = (entry?.allotment_details || []).reduce((s, r) => s + safeNum(r.cif_fc), 0);
        const balQty = Math.max(0, reqQ - allotedQty);
        const bal$ = Math.max(0, req$ - alloted$);

        return (
            <div className="mb-3">
                {chip("Balance", balQty.toLocaleString("en-IN"), balQty === 0 ? "success" : "warning")}
                {chip("Allotted Qty", allotedQty.toLocaleString("en-IN"), "primary")}
                {chip("Allotted $", round2(alloted$).toLocaleString("en-IN", {minimumFractionDigits: 2}), "primary")}
            </div>
        );
    };

    return (
        <Card>
            <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Item:</strong> {entry?.item_name || form.item_name || "-"}
                        <span className="ms-3"><strong>Invoice:</strong> {entry?.invoice || "-"}</span>
                        <span className="ms-3"><strong>ETA:</strong> {entry?.estimated_arrival_date || "-"}</span>
                        <span className="ms-3"><strong>BL:</strong> {entry?.bl_detail || "-"}</span>
                    </div>
                    <div/>
                </div>
            </Card.Header>

            <Card.Body>
                {headerChips()}

                <Tabs activeKey={activeKey} onSelect={(k) => setActiveKey(k)} className="mb-3" justify>
                    {/* TAB 1: CREATE */}
                    <Tab eventKey="create" title="1) Create" disabled={!!initialId}>
                        <AllotmentForm
                            mode="create"
                            onCreated={(created) => {
                                setEntry(created);
                                setActiveKey("allot");
                            }}
                        />
                    </Tab>

                    {/* TAB 2: MAKE ALLOTMENT */}
                    <Tab eventKey="allot" title="2) Make Allotment" disabled={!entry?.id || loadingEntry}>
                        {loadingEntry ? (
                            <div className="text-muted"><Spinner size="sm"/> Loading allotment…</div>
                        ) : !entry?.id ? (
                            <div className="text-muted">Create and save an allotment first.</div>
                        ) : (
                            <AllotmentLineItemTable
                                items={items}
                                errors={{}}
                                onItemChange={() => {
                                }}
                                onAddRow={() => {
                                }}
                                onRemoveRow={onRemoveRow}
                                defaultItemName={entry?.item_name}
                                unitPrice={unitPriceFromState}
                                requiredQuantity={entry?.required_quantity}
                                requiredValue={derivedRequired$}
                                remainingQty={remaining.rQty}
                                remainingValue={remaining.rFC}
                                epsilon={EPS}
                                allotmentId={entry?.id}
                                onSaved={refreshFromServer}
                            />
                        )}
                    </Tab>

                    {/* TAB 3: MAKE TL */}
                    <Tab eventKey="tl" title="3) Make TL" disabled={!entry?.id}>
                        {!entry?.id ? (
                            <div className="text-muted">Create and save an allotment first.</div>
                        ) : (
                            <AllotmentTLTab entry={entry}/>
                        )}
                    </Tab>
                </Tabs>
            </Card.Body>
        </Card>
    );
}
