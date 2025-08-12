import React, {useCallback, useState} from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncCompanySelect from '../../../components/AsyncCompanySelect.jsx';
import AsyncPortSelect from '../../../components/AsyncPortSelect.jsx';
import axios from '../../../api/axiosInstance.js';
import {toast} from 'react-toastify';
import AllotmentLineItemTable from '../components/AllotmentLineItemTable';

const AllotmentCreateForm = ({entry, isNew = false, onClose, onSaved}) => {
    const normalizeEntry = useCallback((e) => {
        const items = (e.allotment_details || []).map((d) => ({
            // create flow doesn't need existing row ids
            sr_number: d.item ? {value: d.item.id, label: d.item.display_name} : null,
            qty: d.qty ?? '',
            cif_fc: d.cif_fc ?? '',
            cif_inr: d.cif_inr ?? '',
            is_boe: !!d.is_boe,
        }));
        return {
            ...e,
            allotment_details: items.length
                ? items
                : [{sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false}],
        };
    }, []);

    const [data, setData] = useState(() => normalizeEntry(entry || {}));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const handleChange = useCallback((field, value) => {
        setData((prev) => ({...prev, [field]: value}));
        setErrors((prev) => {
            const n = {...prev};
            delete n[field];
            return n;
        });
    }, []);

    const handleItemChange = useCallback(
        (index, field, value) => {
            const updated = [...(data.allotment_details || [])];
            updated[index] = {...updated[index], [field]: value};
            setData((prev) => ({...prev, allotment_details: updated}));
            setErrors((prev) => {
                const n = {...prev};
                delete n[`item_${index}_${field}`];
                return n;
            });
        },
        [data.allotment_details]
    );

    const addItemRow = () =>
        setData((prev) => ({
            ...prev,
            allotment_details: [
                ...(prev.allotment_details || []),
                {sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false},
            ],
        }));

    const removeItemRow = (index) => {
        const updated = [...(data.allotment_details || [])];
        updated.splice(index, 1);
        if (updated.length === 0) {
            updated.push({sr_number: null, qty: '', cif_fc: '', cif_inr: '', is_boe: false});
        }
        setData((prev) => ({...prev, allotment_details: updated}));
    };

    const validate = () => {
        const errs = {};
        if (!data.company) errs.company = 'Required';
        if (!data.item_name) errs.item_name = 'Required';
        if (data.required_quantity == null || data.required_quantity === '' || isNaN(data.required_quantity)) {
            errs.required_quantity = 'Enter valid number';
        }
        if (data.unit_value_per_unit == null || data.unit_value_per_unit === '' || isNaN(data.unit_value_per_unit)) {
            errs.unit_value_per_unit = 'Enter valid number';
        }
        (data.allotment_details || []).forEach((item, idx) => {
            const srValue = item.sr_number?.value;
            if (!srValue) errs[`item_${idx}_sr`] = 'License Item is required';
            if (!item.qty || isNaN(item.qty) || Number(item.qty) <= 0) errs[`item_${idx}_qty`] = 'Invalid';
            if (item.cif_fc && isNaN(item.cif_fc)) errs[`item_${idx}_fc`] = 'Invalid';
            if (item.cif_inr && isNaN(item.cif_inr)) errs[`item_${idx}_inr`] = 'Invalid';
        });
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
            const payload = {
                company_id: data.company?.id,
                port_id: data.port?.id || null,
                required_quantity: Number(data.required_quantity) || 0,
                unit_value_per_unit: Number(data.unit_value_per_unit) || 0,
                item_name: data.item_name,
                contact_person: data.contact_person || null,
                contact_number: data.contact_number || null,
                invoice: data.invoice || null,
                estimated_arrival_date: data.estimated_arrival_date || null,
                bl_detail: data.bl_detail || null,
                allotment_details: (data.allotment_details || []).map((d) => ({
                    item_id: d.sr_number?.value || null,
                    qty: d.qty ? Number(d.qty) : 0,
                    cif_fc: d.cif_fc ? Number(d.cif_fc) : 0,
                    cif_inr: d.cif_inr ? Number(d.cif_inr) : 0,
                    is_boe: !!d.is_boe,
                })),
            };

            if (isNew || !data.id) {
                await axios.post('/api/allotments/', payload);
                toast.success('Allotment Created');
            } else {
                await axios.patch(`/api/allotments/${data.id}/`, payload);
                toast.success('Allotment Updated');
            }
            onSaved?.();
        } catch (err) {
            console.error(err);
            const apiErrors = err.response?.data;
            if (apiErrors) setErrors(apiErrors);
            toast.error('Failed to save allotment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form>
            {Object.keys(errors).length > 0 && (
                <div className="alert alert-danger py-2 small">
                    <strong className="d-block mb-1">Please resolve the following validation issues:</strong>
                    <ul className="mb-0 ps-3">
                        {Object.entries(errors).map(([field, msg], i) => (
                            <li key={i}>
                                <span className="text-capitalize">{field.replace(/_/g, ' ')}</span>:{' '}
                                {Array.isArray(msg) ? msg.join(', ') : msg}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect value={data.company ?? ''} onChange={(v) => handleChange('company', v)}/>
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={4}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect value={data.port ?? ''} onChange={(v) => handleChange('port', v)}/>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Item Name</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.item_name || ''}
                        isInvalid={!!errors.item_name}
                        onChange={(e) => handleChange('item_name', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.item_name}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Required Quantity</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.required_quantity ?? ''}
                        isInvalid={!!errors.required_quantity}
                        onChange={(e) => handleChange('required_quantity', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.required_quantity}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Unit Value / Unit</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.01"
                        value={data.unit_value_per_unit ?? ''}
                        isInvalid={!!errors.unit_value_per_unit}
                        onChange={(e) => handleChange('unit_value_per_unit', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.unit_value_per_unit}</Form.Control.Feedback>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Control size="sm" value={data.invoice || ''}
                                  onChange={(e) => handleChange('invoice', e.target.value)}/>
                </Col>
                <Col md={4}>
                    <Form.Label>Estimated Arrival</Form.Label>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={data.estimated_arrival_date || ''}
                        onChange={(e) => handleChange('estimated_arrival_date', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>BL Detail</Form.Label>
                    <Form.Control size="sm" value={data.bl_detail || ''}
                                  onChange={(e) => handleChange('bl_detail', e.target.value)}/>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control size="sm" value={data.contact_person || ''}
                                  onChange={(e) => handleChange('contact_person', e.target.value)}/>
                </Col>
                <Col md={6}>
                    <Form.Label>Contact Number</Form.Label>
                    <Form.Control size="sm" value={data.contact_number || ''}
                                  onChange={(e) => handleChange('contact_number', e.target.value)}/>
                </Col>
            </Row>

            <AllotmentLineItemTable
                items={data.allotment_details || []}
                errors={errors}
                onItemChange={handleItemChange}
                onAddRow={addItemRow}
                onRemoveRow={removeItemRow}
            />

            <div className="mt-3">
                <Button variant="success" size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
                {onClose && (
                    <Button variant="secondary" size="sm" className="ms-2" onClick={onClose}>
                        Cancel
                    </Button>
                )}
            </div>
        </Form>
    );
};

export default AllotmentCreateForm;
