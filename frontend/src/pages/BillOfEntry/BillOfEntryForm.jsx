// BillOfEntryForm.jsx
import React, {useMemo, useRef, useState} from 'react';
import {Button, Col, Form, Row, Table} from 'react-bootstrap';
import AsyncCompanySelect from './AsyncCompanySelect';
import AsyncPortSelect from './AsyncPortSelect';
import AsyncAllotmentSelect from './AsyncAllotmentSelect';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';

const BillOfEntryForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [data, setData] = useState(entry);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [exchangeRateError, setExchangeRateError] = useState(false);
    const exchangeRateRef = useRef();

    const handleChange = (field, value) => {
        setData(prev => ({...prev, [field]: value}));
        setErrors(prev => ({...prev, [field]: null}));
    };

    const handleItemChange = (index, field, value) => {
        const updatedItems = [...data.item_details];
        const item = {...updatedItems[index], [field]: value};
        const rate = parseFloat(data.exchange_rate || 0);

        if ((field === 'cif_fc' || field === 'cif_inr') && (!rate || rate <= 0)) {
            toast.warning('Please enter a valid Exchange Rate first');
            setExchangeRateError(true);
            exchangeRateRef.current?.focus();
            return;
        }

        if (field === 'cif_fc') {
            const fc = parseFloat(value || 0);
            item.cif_inr = (fc * rate).toFixed(2);
        } else if (field === 'cif_inr') {
            const inr = parseFloat(value || 0);
            item.cif_fc = (inr / rate).toFixed(2);
        }

        updatedItems[index] = item;
        setData(prev => ({...prev, item_details: updatedItems}));
    };

    const addItemRow = () => {
        setData(prev => ({
            ...prev,
            item_details: [...prev.item_details, {
                sr_number: '',
                sr_number_display: '',
                transaction_type: 'D',
                qty: '',
                cif_fc: '',
                cif_inr: ''
            }]
        }));
    };

    const removeItemRow = (index) => {
        const updated = [...data.item_details];
        updated.splice(index, 1);
        setData(prev => ({...prev, item_details: updated}));
    };

    const totalQuantity = useMemo(() =>
        data.item_details.reduce((sum, row) => sum + parseFloat(row.qty || 0), 0), [data.item_details]);

    const totalCifInr = useMemo(() =>
        data.item_details.reduce((sum, row) => sum + parseFloat(row.cif_inr || 0), 0), [data.item_details]);

    const totalCifUsd = useMemo(() =>
        data.item_details.reduce((sum, row) => sum + parseFloat(row.cif_fc || 0), 0), [data.item_details]);

    const validate = () => {
        const errs = {};
        if (!data.bill_of_entry_number) errs.bill_of_entry_number = 'Required';
        if (!data.bill_of_entry_date) errs.bill_of_entry_date = 'Required';
        if (!data.company) errs.company = 'Required';
        if (!data.port) errs.port = 'Required';
        if (!data.invoice_no) errs.invoice_no = 'Required';
        if (!data.product_name) errs.product_name = 'Required';
        if (!data.exchange_rate || isNaN(data.exchange_rate)) errs.exchange_rate = 'Enter valid number';

        data.item_details.forEach((item, idx) => {
            if (!item.sr_number_display) errs[`item_${idx}_sr`] = 'Required';
            if (!item.qty || isNaN(item.qty)) errs[`item_${idx}_qty`] = 'Invalid';
            if (!item.cif_fc || isNaN(item.cif_fc)) errs[`item_${idx}_fc`] = 'Invalid';
            if (!item.cif_inr || isNaN(item.cif_inr)) errs[`item_${idx}_inr`] = 'Invalid';
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
                ...data,
                port: data.port?.id,
                company: data.company?.id,
                allotment: data.allotment.map(a => a.id),
            };
            if (isNew) {
                await axios.post('/api/bill-of-entries/', payload);
                toast.success('Bill of Entry Created');
            } else {
                await axios.patch(`/api/bill-of-entries/${data.id}/`, payload);
                toast.success('Bill of Entry Updated');
            }
            onSaved?.();
        } catch (err) {
            toast.error('Failed to save entry');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form>
            <Row className="mb-3">
                <Col md={3}>
                    <Form.Label>BOE Number</Form.Label>
                    <Form.Control size="sm" value={data.bill_of_entry_number}
                                  isInvalid={!!errors.bill_of_entry_number}
                                  onChange={(e) => handleChange('bill_of_entry_number', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.bill_of_entry_number}</Form.Control.Feedback>
                </Col>
                <Col md={3}>
                    <Form.Label>Date</Form.Label>
                    <Form.Control size="sm" type="date" value={data.bill_of_entry_date}
                                  isInvalid={!!errors.bill_of_entry_date}
                                  onChange={(e) => handleChange('bill_of_entry_date', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.bill_of_entry_date}</Form.Control.Feedback>
                </Col>
                <Col md={3}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect value={data.company} onChange={(v) => handleChange('company', v)}/>
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={3}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect value={data.port} onChange={(v) => handleChange('port', v)}/>
                    {errors.port && <div className="text-danger small">{errors.port}</div>}
                </Col>
            </Row>
            <Row className="mb-3">
                <Col>
                    <Form.Label>Allotments</Form.Label>
                    <AsyncAllotmentSelect value={data.allotment} onChange={(v) => handleChange('allotment', v)}/>
                    {errors.allotment && <div className="text-danger small">{errors.allotment}</div>}
                </Col>
            </Row>
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Invoice No</Form.Label>
                    <Form.Control size="sm" value={data.invoice_no}
                                  isInvalid={!!errors.invoice_no}
                                  onChange={(e) => handleChange('invoice_no', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.invoice_no}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Product Name</Form.Label>
                    <Form.Control size="sm" value={data.product_name}
                                  isInvalid={!!errors.product_name}
                                  onChange={(e) => handleChange('product_name', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.product_name}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label>Exchange Rate</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.0001"
                        value={data.exchange_rate}
                        ref={exchangeRateRef}
                        isInvalid={!!errors.exchange_rate || exchangeRateError}
                        onChange={(e) => {
                            setExchangeRateError(false);
                            handleChange('exchange_rate', e.target.value);
                        }}
                    />
                    <Form.Control.Feedback type="invalid">
                        {errors.exchange_rate || 'Exchange rate is required'}
                    </Form.Control.Feedback>
                </Col>
            </Row>

            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>SR No Display</th>
                    <th>Qty</th>
                    <th>CIF FC</th>
                    <th>CIF INR</th>
                    <th></th>
                </tr>
                </thead>
                <tbody>
                {data.item_details.map((item, idx) => (
                    <tr key={idx}>
                        <td>
                            <Form.Control size="sm" value={item.sr_number_display}
                                          isInvalid={!!errors[`item_${idx}_sr`]}
                                          onChange={(e) => handleItemChange(idx, 'sr_number_display', e.target.value)}/>
                            <Form.Control.Feedback type="invalid">{errors[`item_${idx}_sr`]}</Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control size="sm" value={item.qty}
                                          isInvalid={!!errors[`item_${idx}_qty`]}
                                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}/>
                            <Form.Control.Feedback type="invalid">{errors[`item_${idx}_qty`]}</Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control size="sm" value={item.cif_fc}
                                          isInvalid={!!errors[`item_${idx}_fc`]}
                                          onChange={(e) => handleItemChange(idx, 'cif_fc', e.target.value)}/>
                            <Form.Control.Feedback type="invalid">{errors[`item_${idx}_fc`]}</Form.Control.Feedback>
                        </td>
                        <td>
                            <Form.Control size="sm" value={item.cif_inr}
                                          isInvalid={!!errors[`item_${idx}_inr`]}
                                          onChange={(e) => handleItemChange(idx, 'cif_inr', e.target.value)}/>
                            <Form.Control.Feedback type="invalid">{errors[`item_${idx}_inr`]}</Form.Control.Feedback>
                        </td>
                        <td>
                            <Button variant="outline-danger" size="sm"
                                    onClick={() => removeItemRow(idx)}>Delete</Button>
                        </td>
                    </tr>
                ))}
                <tr className="table-light">
                    <td><strong>Totals</strong></td>
                    <td><strong>{totalQuantity}</strong></td>
                    <td><strong>{totalCifUsd.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong></td>
                    <td><strong>{totalCifInr.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong></td>
                    <td></td>
                </tr>
                </tbody>
            </Table>

            <Button size="sm" variant="outline-primary" onClick={addItemRow}>+ Add Item</Button>

            <div className="mt-3">
                <Button variant="success" size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
                {onClose && <Button variant="secondary" size="sm" className="ms-2" onClick={onClose}>Cancel</Button>}
            </div>
        </Form>
    );
};

export default BillOfEntryForm;
