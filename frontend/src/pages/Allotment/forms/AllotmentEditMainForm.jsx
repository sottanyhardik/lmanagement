import React, {useCallback, useState} from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncCompanySelect from '../../../components/AsyncCompanySelect.jsx';
import AsyncPortSelect from '../../../components/AsyncPortSelect.jsx';
import axios from '../../../api/axiosInstance';
import {toast} from 'react-toastify';

const AllotmentEditMainForm = ({entry, onSaved}) => {
    const [data, setData] = useState(() => ({
        id: entry?.id,
        company: entry?.company || null,
        port: entry?.port || null,
        related_company: entry?.related_company || null,
        item_name: entry?.item_name || '',
        required_quantity: entry?.required_quantity ?? '',
        unit_value_per_unit: entry?.unit_value_per_unit ?? '',
        invoice: entry?.invoice || '',
        estimated_arrival_date: entry?.estimated_arrival_date || '',
        bl_detail: entry?.bl_detail || '',
        contact_person: entry?.contact_person || '',
        contact_number: entry?.contact_number || '',
    }));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const setField = useCallback((k, v) => {
        setData(prev => ({...prev, [k]: v}));
        setErrors(prev => {
            const n = {...prev};
            delete n[k];
            return n;
        });
    }, []);

    const validate = () => {
        const errs = {};
        if (!data.company) errs.company = 'Required';
        if (!data.item_name) errs.item_name = 'Required';
        if (data.required_quantity === '' || isNaN(data.required_quantity)) errs.required_quantity = 'Enter valid number';
        if (data.unit_value_per_unit === '' || isNaN(data.unit_value_per_unit)) errs.unit_value_per_unit = 'Enter valid number';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const save = async () => {
        if (!validate()) return toast.error('Please fix validation errors');
        setSaving(true);
        try {
            await axios.patch(`/api/allotments/${data.id}/`, {
                company_id: data.company?.id,
                port_id: data.port?.id || null,
                related_company_id: data.related_company?.id || null,
                item_name: data.item_name,
                required_quantity: Number(data.required_quantity) || 0,
                unit_value_per_unit: Number(data.unit_value_per_unit) || 0,
                invoice: data.invoice || null,
                estimated_arrival_date: data.estimated_arrival_date || null,
                bl_detail: data.bl_detail || null,
                contact_person: data.contact_person || null,
                contact_number: data.contact_number || null,
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
                            <li key={k}><strong>{k}</strong>: {Array.isArray(v) ? v.join(', ') : String(v)}</li>
                        ))}
                    </ul>
                </div>
            )}

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect value={data.company ?? ''} onChange={(v) => setField('company', v)}/>
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={4}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect value={data.port ?? ''} onChange={(v) => setField('port', v)}/>
                </Col>
                <Col md={4}>
                    <Form.Label>Related Company</Form.Label>
                    <AsyncCompanySelect value={data.related_company ?? ''}
                                        onChange={(v) => setField('related_company', v)}/>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Item Name</Form.Label>
                    <Form.Control size="sm" value={data.item_name} isInvalid={!!errors.item_name}
                                  onChange={(e) => setField('item_name', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.item_name}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Required Quantity</Form.Label>
                    <Form.Control size="sm" type="number" step="0.01" value={data.required_quantity}
                                  isInvalid={!!errors.required_quantity}
                                  onChange={(e) => setField('required_quantity', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.required_quantity}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Unit Value / Unit</Form.Label>
                    <Form.Control size="sm" type="number" step="0.01" value={data.unit_value_per_unit}
                                  isInvalid={!!errors.unit_value_per_unit}
                                  onChange={(e) => setField('unit_value_per_unit', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.unit_value_per_unit}</Form.Control.Feedback>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Control size="sm" value={data.invoice} onChange={(e) => setField('invoice', e.target.value)}/>
                </Col>
                <Col md={4}>
                    <Form.Label>Estimated Arrival</Form.Label>
                    <Form.Control size="sm" type="date" value={data.estimated_arrival_date || ''}
                                  onChange={(e) => setField('estimated_arrival_date', e.target.value)}/>
                </Col>
                <Col md={4}>
                    <Form.Label>BL Detail</Form.Label>
                    <Form.Control size="sm" value={data.bl_detail}
                                  onChange={(e) => setField('bl_detail', e.target.value)}/>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control size="sm" value={data.contact_person}
                                  onChange={(e) => setField('contact_person', e.target.value)}/>
                </Col>
                <Col md={6}>
                    <Form.Label>Contact Number</Form.Label>
                    <Form.Control size="sm" value={data.contact_number}
                                  onChange={(e) => setField('contact_number', e.target.value)}/>
                </Col>
            </Row>

            <Button size="sm" variant="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
            </Button>
        </Form>
    );
};

export default AllotmentEditMainForm;
