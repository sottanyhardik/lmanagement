// src/pages/Allotment/forms/AllotmentForm.jsx
import React, {useCallback, useMemo, useState} from "react";
import {Button, Col, Form, Row, Spinner} from "react-bootstrap";
import axios from "../../../api/axiosInstance.js";
import {toast} from "react-toastify";
import AsyncCompanySelect from "../../../components/AsyncSelect/AsyncCompanySelect.jsx";
import AsyncPortSelect from "../../../components/AsyncSelect/AsyncPortSelect.jsx";

const toNum = (v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
};
const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "");

export default function AllotmentForm({
                                          mode,              // "create" | "edit" (optional)
                                          entry = null,
                                          onCreated,
                                          onSaved,
                                      }) {
    const inferredMode = mode ?? (entry?.id ? "edit" : "create");
    const isCreate = inferredMode === "create";

    const [data, setData] = useState(() => ({
        id: entry?.id,
        company: entry?.company || null,
        port: entry?.port || null,
        item_name: entry?.item_name || "",
        required_quantity: entry?.required_quantity ?? "",
        unit_value_per_unit: entry?.unit_value_per_unit ?? "",
        invoice: entry?.invoice || "",
        estimated_arrival_date: entry?.estimated_arrival_date || "",
        bl_detail: entry?.bl_detail || "",
        contact_person: entry?.contact_person || "",
        contact_number: entry?.contact_number || "",
        exchange_rate: entry?.exchange_rate ?? "",       // required for INR calc
        required_cif_inr: entry?.required_cif_inr ?? "", // ↔ with cif_fc via rate
        required_cif_fc: entry?.required_cif_fc ?? "",   // the single $ field
    }));

    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const setField = useCallback((k, v) => {
        setData((prev) => ({...prev, [k]: v}));
        setErrors((prev) => {
            const n = {...prev};
            delete n[k];
            return n;
        });
    }, []);

    // ----- Smart linking helpers -----
    const recalcFromQtyAndUnit = (qtyRaw, unitRaw) => {
        const qty = toNum(qtyRaw);
        const unit = toNum(unitRaw);
        const rate = toNum(data.exchange_rate);
        if (qty && qty > 0 && unit != null) {
            const cifFc = qty * unit;
            setData((p) => ({...p, required_cif_fc: fmt(cifFc)}));
            if (rate && rate > 0) {
                setData((p) => ({...p, required_cif_inr: fmt(cifFc * rate)}));
            }
        }
    };

    const recalcInrFromRate = (rateRaw) => {
        const rate = toNum(rateRaw);
        const cifFc = toNum(data.required_cif_fc);
        const cifInr = toNum(data.required_cif_inr);
        const qty = toNum(data.required_quantity);

        if (rate && rate > 0) {
            // If we already have CIF $, push to ₹
            if (cifFc != null) {
                setData((p) => ({...p, required_cif_inr: fmt(cifFc * rate)}));
            }
            // If we have qty + CIF ₹ but not $/unit, back-solve (case #3)
            else if (qty && qty > 0 && cifInr != null) {
                const newCifFc = cifInr / rate;
                const unit = newCifFc / qty;
                setData((p) => ({
                    ...p,
                    required_cif_fc: fmt(newCifFc),
                    unit_value_per_unit: fmt(unit, 4),
                }));
            }
        }
    };

    const recalcFromCifInr = (inrRaw) => {
        const inr = toNum(inrRaw);
        const rate = toNum(data.exchange_rate);
        const qty = toNum(data.required_quantity);
        if (inr != null && rate && rate > 0) {
            const cifFc = inr / rate;
            const unit = qty && qty > 0 ? cifFc / qty : null;
            setData((p) => ({
                ...p,
                required_cif_fc: fmt(cifFc),
                ...(unit != null ? {unit_value_per_unit: fmt(unit, 4)} : {}),
            }));
        }
    };

    // Keep derived unit value if qty + cif_fc available
    const derived = useMemo(() => {
        const rq = toNum(data.required_quantity);
        const fc = toNum(data.required_cif_fc);
        const unitVal = rq && rq > 0 && fc != null ? fc / rq : null;
        return {unitVal};
    }, [data.required_quantity, data.required_cif_fc]);

    // ----- field setters that trigger linking -----
    const onQtyChange = (v) => {
        setField("required_quantity", v);
        recalcFromQtyAndUnit(v, data.unit_value_per_unit);
    };

    const onUnitChange = (v) => {
        setField("unit_value_per_unit", v);
        recalcFromQtyAndUnit(data.required_quantity, v);
    };

    const onRateChange = (v) => {
        setField("exchange_rate", v);
        recalcInrFromRate(v);
    };

    const onCifFcChange = (v) => {
        // You can still edit CIF $ directly if needed
        setField("required_cif_fc", v);
        const cifFc = toNum(v);
        const rate = toNum(data.exchange_rate);
        const qty = toNum(data.required_quantity);
        if (cifFc != null) {
            if (rate && rate > 0) {
                setData((p) => ({...p, required_cif_inr: fmt(cifFc * rate)}));
            }
            if (qty && qty > 0) {
                setData((p) => ({...p, unit_value_per_unit: fmt(cifFc / qty, 4)}));
            }
        }
    };

    const onCifInrChange = (v) => {
        setField("required_cif_inr", v);
        recalcFromCifInr(v);
    };

    // ---------- validation ----------
    const validate = () => {
        const errs = {};
        if (!data.company) errs.company = "Required";
        if (!data.item_name) errs.item_name = "Required";

        if (data.required_quantity === "" || isNaN(data.required_quantity)) {
            errs.required_quantity = "Enter valid number";
        } else if (Number(data.required_quantity) <= 0) {
            errs.required_quantity = "Must be greater than 0";
        }

        if (data.exchange_rate === "" || isNaN(data.exchange_rate)) {
            errs.exchange_rate = "Exchange rate is required";
        } else if (Number(data.exchange_rate) <= 0) {
            errs.exchange_rate = "Exchange rate must be > 0";
        }

        // If either CIF field is provided, ensure numeric
        if (String(data.required_cif_fc).trim() !== "" && isNaN(data.required_cif_fc)) {
            errs.required_cif_fc = "Enter valid number";
        }
        if (String(data.required_cif_inr).trim() !== "" && isNaN(data.required_cif_inr)) {
            errs.required_cif_inr = "Enter valid number";
        }

        // If not derivable, allow manual unit input; else readOnly is okay
        if (!Number.isFinite(derived.unitVal)) {
            if (data.unit_value_per_unit === "" || isNaN(data.unit_value_per_unit)) {
                errs.unit_value_per_unit = "Enter valid number or provide CIF / Qty";
            } else if (Number(data.unit_value_per_unit) < 0) {
                errs.unit_value_per_unit = "Must be ≥ 0";
            }
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ---------- submit ----------
    const submit = async (e) => {
        e?.preventDefault?.();
        if (!validate()) {
            toast.error("Please fix validation errors");
            return;
        }
        setSaving(true);
        try {
            const computedUnit = derived.unitVal;
            const unitValue = Number.isFinite(computedUnit)
                ? computedUnit
                : Number(data.unit_value_per_unit) || 0;

            const payload = {
                company_id: data.company?.id || null,
                port_id: data.port?.id || null,
                item_name: data.item_name,
                required_quantity: Number(data.required_quantity) || 0,
                unit_value_per_unit: unitValue,
                invoice: data.invoice || null,
                estimated_arrival_date: data.estimated_arrival_date || null,
                bl_detail: data.bl_detail || null,
                contact_person: data.contact_person || null,
                contact_number: data.contact_number || null,
                exchange_rate: Number(data.exchange_rate) || 0,
                required_cif_inr: data.required_cif_inr !== "" ? Number(data.required_cif_inr) : 0,
                required_cif_fc: data.required_cif_fc !== "" ? Number(data.required_cif_fc) : 0,
            };

            if (isCreate) {
                const {data: created} = await axios.post("allotments/", payload);
                toast.success("Allotment created");
                onCreated?.(created);
            } else {
                await axios.patch(`allotments/${data.id}/`, payload);
                toast.success("Allotment updated");
                onSaved?.();
            }
        } catch (err) {
            const apiErrors = err.response?.data;
            if (apiErrors && typeof apiErrors === "object") {
                setErrors(apiErrors);
                const first = Object.values(apiErrors)[0];
                toast.error(Array.isArray(first) ? first.join(", ") : String(first));
            } else {
                toast.error(`Failed to ${isCreate ? "create" : "update"}`);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form onSubmit={submit}>
            {Object.keys(errors).length > 0 && (
                <div className="alert alert-danger py-2 small">
                    <ul className="mb-0 ps-3">
                        {Object.entries(errors).map(([k, v]) => (
                            <li key={k}>
                                <strong>{k}</strong>: {Array.isArray(v) ? v.join(", ") : String(v)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Row className="g-3">
                <Col md={3}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect value={data.company ?? ""} onChange={(v) => setField("company", v)}/>
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>

                <Col md={3}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect value={data.port ?? ""} onChange={(v) => setField("port", v)}/>
                </Col>

                <Col md={3}>
                    <Form.Label>Item Name</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.item_name}
                        isInvalid={!!errors.item_name}
                        onChange={(e) => setField("item_name", e.target.value)}
                        placeholder="ORANGE OIL"
                    />
                    <Form.Control.Feedback type="invalid">{errors.item_name}</Form.Control.Feedback>
                </Col>

                <Col md={3}>
                    <Form.Label>Required Quantity</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="1"
                        value={data.required_quantity}
                        isInvalid={!!errors.required_quantity}
                        onChange={(e) => onQtyChange(e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_quantity}</Form.Control.Feedback>
                </Col>

                <Col md={3}>
                    <Form.Label>Unit Price ($/unit)</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.unit_value_per_unit}
                        isInvalid={!!errors.unit_value_per_unit}
                        onChange={(e) => onUnitChange(e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.unit_value_per_unit}</Form.Control.Feedback>
                    {Number.isFinite(derived.unitVal) && (
                        <div className="form-text">Auto: CIF ($) ÷ Required Quantity</div>
                    )}
                </Col>

                <Col md={3}>
                    <Form.Label>Exchange Rate (₹ per $) <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.0001"
                        value={data.exchange_rate}
                        isInvalid={!!errors.exchange_rate}
                        onChange={(e) => onRateChange(e.target.value)}
                        placeholder="e.g., 83.25"
                    />
                    <Form.Control.Feedback type="invalid">{errors.exchange_rate}</Form.Control.Feedback>
                </Col>

                {/* SINGLE $ FIELD */}
                <Col md={3}>
                    <Form.Label>Required CIF ($)</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.required_cif_fc}
                        isInvalid={!!errors.required_cif_fc}
                        onChange={(e) => onCifFcChange(e.target.value)}
                        placeholder="Total CIF in USD"
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_cif_fc}</Form.Control.Feedback>
                    <div className="form-text">Auto-calculates from Qty × Unit, or from ₹ / rate.</div>
                </Col>

                <Col md={3}>
                    <Form.Label>Required CIF (₹)</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.required_cif_inr}
                        isInvalid={!!errors.required_cif_inr}
                        onChange={(e) => onCifInrChange(e.target.value)}
                        placeholder="Total CIF in INR"
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_cif_inr}</Form.Control.Feedback>
                    <div className="form-text">Synced with CIF ($) via exchange rate.</div>
                </Col>

                <Col md={3}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Control size="sm" value={data.invoice} onChange={(e) => setField("invoice", e.target.value)}/>
                </Col>

                <Col md={3}>
                    <Form.Label>ETA</Form.Label>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={data.estimated_arrival_date || ""}
                        onChange={(e) => setField("estimated_arrival_date", e.target.value)}
                    />
                </Col>

                <Col md={6}>
                    <Form.Label>BL Detail</Form.Label>
                    <Form.Control size="sm" value={data.bl_detail}
                                  onChange={(e) => setField("bl_detail", e.target.value)}/>
                </Col>

                <Col md={3}>
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control size="sm" value={data.contact_person}
                                  onChange={(e) => setField("contact_person", e.target.value)}/>
                </Col>

                <Col md={3}>
                    <Form.Label>Contact Number</Form.Label>
                    <Form.Control size="sm" value={data.contact_number}
                                  onChange={(e) => setField("contact_number", e.target.value)}/>
                </Col>
            </Row>

            <div className="mt-3">
                <Button type="submit" variant={isCreate ? "success" : "primary"} size="sm" disabled={saving}>
                    {saving ? (
                        <>
                            <Spinner size="sm" className="me-1"/>
                            {isCreate ? "Saving…" : "Saving…"}
                        </>
                    ) : (
                        isCreate ? "Save & Continue" : "Save"
                    )}
                </Button>
            </div>
        </Form>
    );
}
