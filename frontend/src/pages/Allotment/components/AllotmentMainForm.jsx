import React, {useCallback, useMemo, useState} from "react";
import {Button, Col, Form, Row, Spinner} from "react-bootstrap";
import axios from "../../../api/axiosInstance";
import {toast} from "react-toastify";
import AsyncCompanySelect from "../../../components/AsyncSelect/AsyncCompanySelect.jsx";
import AsyncPortSelect from "../../../components/AsyncSelect/AsyncPortSelect.jsx";

const toNum = (v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
};
const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "");

/**
 * Reusable main form for Allotment:
 * - mode: "create" | "edit"  (default: "create")
 * - initial: allotment record when editing (optional for create)
 * - onSaved(entry): called after successful PATCH (edit)
 * - onCreated(entry): called after successful POST (create)
 */
export default function AllotmentMainForm({
                                              mode = "create",
                                              initial = null,
                                              onSaved,
                                              onCreated,
                                          }) {
    const isCreate = mode === "create";

    const [data, setData] = useState(() => ({
        id: initial?.id,
        company: initial?.company || null,
        port: initial?.port || null,
        item_name: initial?.item_name || "",
        required_quantity: initial?.required_quantity ?? "",
        unit_value_per_unit: initial?.unit_value_per_unit ?? "",
        invoice: initial?.invoice || "",
        estimated_arrival_date: initial?.estimated_arrival_date || "",
        bl_detail: initial?.bl_detail || "",
        contact_person: initial?.contact_person || "",
        contact_number: initial?.contact_number || "",
        exchange_rate: initial?.exchange_rate ?? "",      // required
        required_cif_inr: initial?.required_cif_inr ?? "",// keeps in sync with fc
        required_cif_fc: initial?.required_cif_fc ?? "",  // keeps in sync with inr
    }));

    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // ---------- field helpers ----------
    const setField = useCallback((k, v) => {
        setData((prev) => ({...prev, [k]: v}));
        setErrors((prev) => {
            const n = {...prev};
            delete n[k];
            return n;
        });
    }, []);

    // keep CIF ₹ / $ synced via exchange_rate
    const setExchangeRate = (v) => {
        setField("exchange_rate", v);
        const rate = toNum(v);
        if (rate && rate > 0) {
            const fc = toNum(data.required_cif_fc);
            const inr = toNum(data.required_cif_inr);
            if (fc != null) setData((p) => ({...p, required_cif_inr: fmt(fc * rate)}));
            else if (inr != null) setData((p) => ({...p, required_cif_fc: fmt(inr / rate)}));
        }
    };

    const setCifFc = (v) => {
        setField("required_cif_fc", v);
        const rate = toNum(data.exchange_rate);
        const fc = toNum(v);
        if (rate && rate > 0 && fc != null) {
            setData((p) => ({...p, required_cif_inr: fmt(fc * rate)}));
        }
    };

    const setCifInr = (v) => {
        setField("required_cif_inr", v);
        const rate = toNum(data.exchange_rate);
        const inr = toNum(v);
        if (rate && rate > 0 && inr != null) {
            setData((p) => ({...p, required_cif_fc: fmt(inr / rate)}));
        }
    };

    // derived unit value = CIF($) / required qty (if both present)
    const derived = useMemo(() => {
        const rq = toNum(data.required_quantity);
        const fc = toNum(data.required_cif_fc);
        const unitVal = rq && rq > 0 && fc != null ? fc / rq : null;
        return {unitVal};
    }, [data.required_quantity, data.required_cif_fc]);

    // also show auto "Required $" for UX
    const autoRequiredUsd = useMemo(() => {
        const rq = toNum(data.required_quantity);
        const unit = toNum(
            Number.isFinite(derived.unitVal) ? derived.unitVal : data.unit_value_per_unit
        );
        return rq && unit != null ? (rq * unit) : null;
    }, [data.required_quantity, data.unit_value_per_unit, derived.unitVal]);

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

        if (String(data.required_cif_fc).trim() !== "" && isNaN(data.required_cif_fc)) {
            errs.required_cif_fc = "Enter valid number";
        }
        if (String(data.required_cif_inr).trim() !== "" && isNaN(data.required_cif_inr)) {
            errs.required_cif_inr = "Enter valid number";
        }

        if (!Number.isFinite(derived.unitVal)) {
            if (data.unit_value_per_unit === "" || isNaN(data.unit_value_per_unit)) {
                errs.unit_value_per_unit = "Enter valid number or provide CIF & rate";
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
                        onChange={(e) => setField("required_quantity", e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_quantity}</Form.Control.Feedback>
                </Col>

                <Col md={3}>
                    <Form.Label>Unit Price ($/unit)</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.0001"
                        value={Number.isFinite(derived.unitVal) ? fmt(derived.unitVal, 4) : data.unit_value_per_unit}
                        readOnly={Number.isFinite(derived.unitVal)}
                        isInvalid={!!errors.unit_value_per_unit}
                        onChange={(e) => setField("unit_value_per_unit", e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                        {errors.unit_value_per_unit}
                    </Form.Control.Feedback>
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
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="e.g., 83.25"
                    />
                    <Form.Control.Feedback type="invalid">{errors.exchange_rate}</Form.Control.Feedback>
                </Col>

                <Col md={3}>
                    <Form.Label>Required $ (auto)</Form.Label>
                    <Form.Control size="sm" value={fmt(autoRequiredUsd)} readOnly/>
                </Col>

                <Col md={3}>
                    <Form.Label>Required CIF (₹)</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.required_cif_inr}
                        isInvalid={!!errors.required_cif_inr}
                        onChange={(e) => setCifInr(e.target.value)}
                        placeholder="Total CIF in INR"
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_cif_inr}</Form.Control.Feedback>
                    <div className="form-text">Syncs with CIF ($) when rate is set.</div>
                </Col>

                <Col md={3}>
                    <Form.Label>Required CIF ($)</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.required_cif_fc}
                        isInvalid={!!errors.required_cif_fc}
                        onChange={(e) => setCifFc(e.target.value)}
                        placeholder="Total CIF in USD"
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_cif_fc}</Form.Control.Feedback>
                    <div className="form-text">Syncs with CIF (₹) when rate is set.</div>
                </Col>

                <Col md={3}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.invoice}
                        onChange={(e) => setField("invoice", e.target.value)}
                    />
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
                    <Form.Control
                        size="sm"
                        value={data.bl_detail}
                        onChange={(e) => setField("bl_detail", e.target.value)}
                    />
                </Col>

                <Col md={3}>
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.contact_person}
                        onChange={(e) => setField("contact_person", e.target.value)}
                    />
                </Col>

                <Col md={3}>
                    <Form.Label>Contact Number</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.contact_number}
                        onChange={(e) => setField("contact_number", e.target.value)}
                    />
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
