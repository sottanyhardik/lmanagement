import React, {useCallback, useMemo, useState} from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncCompanySelect from '../../../components/AsyncCompanySelect.jsx';
import AsyncPortSelect from '../../../components/AsyncPortSelect.jsx';
import axios from '../../../api/axiosInstance';
import {toast} from 'react-toastify';

const toNum = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
};
const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '');

const AllotmentEditMainForm = ({entry, onSaved}) => {
    const [data, setData] = useState(() => ({
        id: entry?.id,
        company: entry?.company || null,
        port: entry?.port || null,
        item_name: entry?.item_name || '',
        required_quantity: entry?.required_quantity ?? '',
        unit_value_per_unit: entry?.unit_value_per_unit ?? '', // will be overridden if computed
        invoice: entry?.invoice || '',
        estimated_arrival_date: entry?.estimated_arrival_date || '',
        bl_detail: entry?.bl_detail || '',
        contact_person: entry?.contact_person || '',
        contact_number: entry?.contact_number || '',
        // New fields for CIF calculation
        exchange_rate: entry?.exchange_rate || '',        // required
        required_cif_inr: entry?.required_cif_inr || '',    // editable, synced with cif_fc via rate
        required_cif_fc: entry?.required_cif_fc || '',     // editable, synced with cif_inr via rate
    }));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // Generic field setter
    const setField = useCallback((k, v) => {
        setData((prev) => ({...prev, [k]: v}));
        setErrors((prev) => {
            const n = {...prev};
            delete n[k];
            return n;
        });
    }, []);

    // Specialized setters to keep CIF ₹, CIF $ in sync with rate
    const setExchangeRate = (v) => {
        setField('exchange_rate', v);
        const rate = toNum(v);
        if (rate && rate > 0) {
            const cifFc = toNum(data.required_cif_fc);
            const cifInr = toNum(data.required_cif_inr);
            if (cifFc != null) {
                setData((prev) => ({...prev, required_cif_inr: fmt(cifFc * rate)}));
            } else if (cifInr != null) {
                setData((prev) => ({...prev, required_cif_fc: fmt(cifInr / rate)}));
            }
        }
    };

    const setCifFc = (v) => {
        setField('required_cif_fc', v);
        const rate = toNum(data.exchange_rate);
        const fc = toNum(v);
        if (rate && rate > 0 && fc != null) {
            setData((prev) => ({...prev, required_cif_inr: fmt(fc * rate)}));
        }
    };

    const setCifInr = (v) => {
        setField('required_cif_inr', v);
        const rate = toNum(data.exchange_rate);
        const inr = toNum(v);
        if (rate && rate > 0 && inr != null) {
            setData((prev) => ({...prev, required_cif_fc: fmt(inr / rate)}));
        }
    };

    // Derived unit value if we have fc + required qty
    const derived = useMemo(() => {
        const rq = toNum(data.required_quantity);
        const fc = toNum(data.required_cif_fc);
        const unitVal = rq && rq > 0 && fc != null ? fc / rq : null;
        return {unitVal};
    }, [data.required_quantity, data.required_cif_fc]);

    const validate = () => {
        const errs = {};
        if (!data.company) errs.company = 'Required';
        if (!data.item_name) errs.item_name = 'Required';

        // Required Quantity
        if (data.required_quantity === '' || isNaN(data.required_quantity)) {
            errs.required_quantity = 'Enter valid number';
        } else if (Number(data.required_quantity) <= 0) {
            errs.required_quantity = 'Must be greater than 0';
        }

        // Exchange rate is REQUIRED
        if (data.exchange_rate === '' || isNaN(data.exchange_rate)) {
            errs.exchange_rate = 'Exchange rate is required';
        } else if (Number(data.exchange_rate) <= 0) {
            errs.exchange_rate = 'Exchange rate must be > 0';
        }

        // If either CIF field is provided, they must be numeric (sync ensures the other)
        if (String(data.required_cif_fc).trim() !== '') {
            if (isNaN(data.required_cif_fc)) errs.required_cif_fc = 'Enter valid number';
        }
        if (String(data.required_cif_inr).trim() !== '') {
            if (isNaN(data.required_cif_inr)) errs.required_cif_inr = 'Enter valid number';
        }

        // If we cannot compute unit value, require manual numeric fallback
        if (!Number.isFinite(derived.unitVal)) {
            if (data.unit_value_per_unit === '' || isNaN(data.unit_value_per_unit)) {
                errs.unit_value_per_unit = 'Enter valid number or provide CIF & rate';
            } else if (Number(data.unit_value_per_unit) < 0) {
                errs.unit_value_per_unit = 'Must be ≥ 0';
            }
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const save = async () => {
        if (!validate()) {
            toast.error('Please fix validation errors');
            return;
        }
        setSaving(true);
        try {
            const computedUnit = derived.unitVal;
            const unitValue = Number.isFinite(computedUnit)
                ? computedUnit
                : Number(data.unit_value_per_unit) || 0;

            await axios.patch(`/api/allotments/${data.id}/`, {
                company_id: data.company?.id,
                port_id: data.port?.id || null,
                item_name: data.item_name,
                required_quantity: Number(data.required_quantity) || 0,
                unit_value_per_unit: unitValue,
                invoice: data.invoice || null,
                estimated_arrival_date: data.estimated_arrival_date || null,
                bl_detail: data.bl_detail || null,
                contact_person: data.contact_person || null,
                contact_number: data.contact_number || null,
                exchange_rate: data.exchange_rate || 0,        // required
                required_cif_inr: data.required_cif_inr || 0,    // editable, synced with cif_fc via rate
                required_cif_fc: data.required_cif_fc || 0,     // editable, synced with cif_inr via rate
            });

            toast.success('Allotment updated');
            onSaved?.();
        } catch (e) {
            const apiErrors = e.response?.data;
            if (apiErrors) setErrors(apiErrors);
            toast.error('Failed to update');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form>
            {Object.keys(errors).length > 0 && (
                <div className="alert alert-danger py-2 small">
                    <ul className="mb-0 ps-3">
                        {Object.entries(errors).map(([k, v]) => (
                            <li key={k}>
                                <strong>{k}</strong>: {Array.isArray(v) ? v.join(', ') : String(v)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect
                        value={data.company ?? ''}
                        onChange={(v) => setField('company', v)}
                    />
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={4}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect
                        value={data.port ?? ''}
                        onChange={(v) => setField('port', v)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Item Name</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.item_name}
                        isInvalid={!!errors.item_name}
                        onChange={(e) => setField('item_name', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                        {errors.item_name}
                    </Form.Control.Feedback>
                </Col>

                <Col md={4}>
                    <Form.Label>Required Quantity</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.required_quantity}
                        isInvalid={!!errors.required_quantity}
                        onChange={(e) => setField('required_quantity', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                        {errors.required_quantity}
                    </Form.Control.Feedback>
                </Col>

                <Col md={4}>
                    <Form.Label>Unit Value / Unit</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.0001"
                        value={
                            Number.isFinite(derived.unitVal)
                                ? fmt(derived.unitVal, 4)
                                : data.unit_value_per_unit
                        }
                        readOnly={Number.isFinite(derived.unitVal)}
                        isInvalid={!!errors.unit_value_per_unit}
                        onChange={(e) => setField('unit_value_per_unit', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">
                        {errors.unit_value_per_unit}
                    </Form.Control.Feedback>
                    {Number.isFinite(derived.unitVal) && (
                        <div className="form-text">
                            Auto: CIF ($) ÷ Required Quantity
                        </div>
                    )}
                </Col>
                <Col md={4}>
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
                    <Form.Control.Feedback type="invalid">
                        {errors.exchange_rate}
                    </Form.Control.Feedback>
                </Col>

                <Col md={4}>
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
                    <Form.Control.Feedback type="invalid">
                        {errors.required_cif_inr}
                    </Form.Control.Feedback>
                    <div className="form-text">Will sync with CIF ($) when rate is set.</div>
                </Col>

                <Col md={4}>
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
                    <Form.Control.Feedback type="invalid">
                        {errors.required_cif_fc}
                    </Form.Control.Feedback>
                    <div className="form-text">Will sync with CIF (₹) when rate is set.</div>
                </Col>
                <Col md={4}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.invoice}
                        onChange={(e) => setField('invoice', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Estimated Arrival</Form.Label>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={data.estimated_arrival_date || ''}
                        onChange={(e) => setField('estimated_arrival_date', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>BL Detail</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.bl_detail}
                        onChange={(e) => setField('bl_detail', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.contact_person}
                        onChange={(e) => setField('contact_person', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Contact Number</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.contact_number}
                        onChange={(e) => setField('contact_number', e.target.value)}
                    />
                </Col>
            </Row>

            <Button size="sm" variant="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
            </Button>
        </Form>
    );
};

export default AllotmentEditMainForm;
