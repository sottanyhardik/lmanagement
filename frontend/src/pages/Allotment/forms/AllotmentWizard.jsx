import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, Card, Col, Form, Row, Spinner, Tab, Tabs} from "react-bootstrap";
import axios from "../../../api/axiosInstance";
import {toast} from "react-toastify";

// Reuse your existing component (from your latest version)
import AllotmentLineItemTable from "../components/AllotmentLineItemTable.jsx";
import AllotmentMainForm from "../components/AllotmentMainForm";

// Utils
const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const roundQty = (n) => Math.max(0, Math.floor(safeNum(n)));
const round2 = (n) => Number(safeNum(n).toFixed(2));

// -------- normalize existing lines into the table’s expected shape ----------
const normalizeLines = (entry) =>
    (entry?.allotment_details || []).map((d) => ({
        id: d.id || null,
        // sr_number label shown in the table’s first column
        sr_number: d.item
            ? {value: d.item.id, label: d.item.display_name}
            : {value: null, label: ""},
        qty: d.qty ?? 0,
        cif_fc: d.cif_fc ?? 0,
        cif_inr: d.cif_inr ?? 0,
        is_boe: !!d.is_boe,
        delete_url: d.delete_url, // if your serializer exposes it
    }));

/**
 * Props:
 *  - allotmentId?: number|string (optional, if you want to open an existing one and jump to tabs 2/3)
 */
export default function AllotmentWizard({allotmentId: initialId}) {
    const [activeKey, setActiveKey] = useState(initialId ? "allot" : "create");
    const [entry, setEntry] = useState(null);
    const [loadingEntry, setLoadingEntry] = useState(!!initialId);

    // ------------- API helpers -------------
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

    // ------------- Tab 1: Create -------------
    const [createSaving, setCreateSaving] = useState(false);
    const [form, setForm] = useState({
        company_id: "",            // swap to your AsyncCompanySelect if you prefer
        port_id: "",
        item_name: "",
        required_quantity: "",
        unit_value_per_unit: "",
        exchange_rate: "",
        required_cif_fc: "",       // if you want to send explicitly; otherwise backend computes from qty*unit
        invoice: "",
        estimated_arrival_date: "",
        bl_detail: "",
    });

    const unitPrice = safeNum(form.unit_value_per_unit);
    const reqQty = roundQty(form.required_quantity);
    const derivedRequired$ = useMemo(() => round2(reqQty * unitPrice), [reqQty, unitPrice]);

    const handleCreateChange = (k, v) => setForm((p) => ({...p, [k]: v}));

    const onCreateSubmit = async (e) => {
        e?.preventDefault?.();
        // very light client validation
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
            required_cif_fc: form.required_cif_fc !== "" ? safeNum(form.required_cif_fc) : derivedRequired$,
            invoice: form.invoice || "",
            estimated_arrival_date: form.estimated_arrival_date || null,
            bl_detail: form.bl_detail || "",
        };

        setCreateSaving(true);
        try {
            const {data} = await axios.post("allotments/", payload);
            setEntry(data);
            toast.success("Allotment created");
            setActiveKey("allot"); // auto-jump to Make Allotment
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

    // ------------- Tab 2: Make Allotment -------------
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

    // ------------- Tab 3: Make TL -------------
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
            toast.error("Failed to create Transfer Letter (not implemented on server?)");
        } finally {
            setTlSaving(false);
        }
    };

    // --------- shared computed chips (top header style like your screenshot) ----------
    const chip = (label, value, variant = "secondary") => (
        <span className={`badge bg-${variant} me-2`} style={{fontSize: "0.85rem"}}>
      {label}: {value}
    </span>
    );

    const headerChips = () => {
        if (!entry) return null;
        const reqQ = roundQty(entry.required_quantity);
        const unit = safeNum(entry.unit_value_per_unit);
        const req$ = entry.required_cif_fc ? round2(entry.required_cif_fc) : round2(reqQ * unit);

        const allotedQty = (entry?.allotment_details || []).reduce((s, r) => s + roundQty(r.qty), 0);
        const alloted$ = (entry?.allotment_details || []).reduce((s, r) => s + safeNum(r.cif_fc), 0);
        const balQty = Math.max(0, reqQ - allotedQty);
        const bal$ = Math.max(0, req$ - alloted$);

        return (
            <div className="mb-3">
                {chip("Balance", balQty.toLocaleString("en-IN"), balQty === 0 ? "success" : "warning")}
                {chip("Allotted Qty", allotedQty.toLocaleString("en-IN"), "primary")}
                {chip("Allotted $", alloted$.toLocaleString("en-IN"), "primary")}
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
                    <div>
                        {/* room for “View / Edit Main / TL as BOE” actions if you want to add later */}
                    </div>
                </div>
            </Card.Header>

            <Card.Body>
                {headerChips()}

                <Tabs activeKey={activeKey} onSelect={(k) => setActiveKey(k)} className="mb-3" justify>
                    {/* ---------------- TAB 1: CREATE ---------------- */}
                    <Tab eventKey="create" title="1) Create" disabled={!!initialId}>
                        <AllotmentMainForm
                            mode="create"
                            onCreated={(created) => {
                                setEntry(created);
                                setActiveKey("allot");  // jump to Make Allotment
                            }}
                        />
                    </Tab>

                    {/* ---------------- TAB 2: MAKE ALLOTMENT ---------------- */}
                    <Tab
                        eventKey="allot"
                        title="2) Make Allotment"
                        disabled={!entry?.id || loadingEntry}
                    >
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
                                unitPrice={entry?.unit_value_per_unit}
                                requiredQuantity={entry?.required_quantity}
                                requiredValue={entry?.required_cif_fc}
                                allotmentId={entry?.id}
                                onSaved={refreshFromServer}
                            />
                        )}
                    </Tab>

                    {/* ---------------- TAB 3: MAKE TL ---------------- */}
                    <Tab
                        eventKey="tl"
                        title="3) Make TL"
                        disabled={!entry?.id}
                    >
                        {!entry?.id ? (
                            <div className="text-muted">Create and save an allotment first.</div>
                        ) : (
                            <Form className="mt-2" onSubmit={(e) => {
                                e.preventDefault();
                                submitTL();
                            }}>
                                <Row className="g-3">
                                    <Col md={6}>
                                        <Form.Label>To Company</Form.Label>
                                        <Form.Control
                                            value={tlForm.to_company}
                                            onChange={(e) => setTlForm((p) => ({...p, to_company: e.target.value}))}
                                            placeholder="Select/enter a company"
                                        />
                                    </Col>
                                    <Col md={12}>
                                        <Form.Label>Remarks</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={4}
                                            value={tlForm.remarks}
                                            onChange={(e) => setTlForm((p) => ({...p, remarks: e.target.value}))}
                                            placeholder="Any special instructions…"
                                        />
                                    </Col>
                                </Row>

                                <div className="mt-3">
                                    <Button variant="primary" onClick={submitTL} disabled={tlSaving}>
                                        {tlSaving ? <><Spinner size="sm"
                                                               className="me-1"/> Creating…</> : "Create Transfer Letter"}
                                    </Button>
                                </div>
                            </Form>
                        )}
                    </Tab>
                </Tabs>
            </Card.Body>
        </Card>
    );
}
