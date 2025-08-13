import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect.jsx';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect.jsx';
import AsyncAllotmentSelect from '../../components/AsyncSelect/AsyncAllotmentSelect.jsx';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import LineItemTable from './LineItemTable';

const BillOfEntryForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [exchangeRateError, setExchangeRateError] = useState(false);
    const exchangeRateRef = useRef();
    const lastRowRef = useRef();

    const normalizeEntry = (entry) => ({
        ...entry,
        item_details: entry.item_details.map(item => ({
            ...item,
            sr_number_display: item.sr_number?.id
                ? {value: item.sr_number.id, label: item.sr_number.display_name}
                : null
        }))
    });

    const [data, setData] = useState(() => {
        const normalized = normalizeEntry(entry);
        return normalized;
    });
    const selectedSrNumbers = useMemo(() =>
        data.item_details.map(item => item.sr_number?.value).filter(Boolean), [data.item_details]);

    const handleChange = useCallback((field, value) => {
        if (field === 'allotment') {
            const first = Array.isArray(value) && value.length > 0 ? value[0] : null;

            const newItems = value.flatMap(a =>
                (a.item_details || []).map(item => ({
                    sr_number: item.item
                        ? {
                            value: item.item.id,
                            label: item.item.display_name
                        }
                        : null,
                    transaction_type: item.transaction_type || 'D',
                    qty: item.qty || '',
                    cif_fc: item.cif_fc || '',
                    cif_inr: item.cif_inr || ''
                }))
            );

            setData(prev => {
                const prevNames = prev.product_name
                    ? prev.product_name.split(',').map(n => n.trim()).filter(Boolean)
                    : [];
                const newNames = value.map(a => a.item_name).filter(Boolean);
                const combinedNames = Array.from(new Set([...prevNames, ...newNames]));

                // Decide base items to work with
                const isEmptyOrSingleBlank = prev.item_details.length === 0 || (
                    prev.item_details.length === 1 &&
                    !prev.item_details[0].sr_number &&
                    !prev.item_details[0].qty &&
                    !prev.item_details[0].cif_fc &&
                    !prev.item_details[0].cif_inr
                );
                const baseItems = isEmptyOrSingleBlank ? [] : prev.item_details;

                // Combine old + new items, filtering duplicates by sr_number.value
                const seen = new Set();
                const combinedItems = [...baseItems, ...newItems].filter(item => {
                    const id = item.sr_number?.value;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                console.log('[Allotment] Combined Items:', combinedItems);

                return {
                    ...prev,
                    allotment: value,
                    product_name: combinedNames.join(', '),
                    company: prev.company || first?.company || null,
                    port: prev.port || first?.port || null,
                    item_details: combinedItems
                };
            });

            // Clear any existing errors for allotment field
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        } else {
            setData(prev => ({...prev, [field]: value}));
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        }


        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[field];
            return newErrors;
        });
    }, []);

    const handleItemChange = useCallback((index, field, value) => {
        const updatedItems = [...data.item_details];
        const item = {...updatedItems[index], [field]: value};
        const rate = parseFloat(data.exchange_rate || 0);

        if ((field === 'cif_fc' || field === 'cif_inr')) {
            if (!rate || rate <= 0) {
                toast.warning('Please enter a valid Exchange Rate first');
                setExchangeRateError(true);
                exchangeRateRef.current?.focus();
                return;
            } else {
                setExchangeRateError(false);

                if (field === 'cif_fc') {
                    const fc = parseFloat(value || 0);
                    item.cif_inr = (fc * rate).toFixed(2);
                } else if (field === 'cif_inr') {
                    const inr = parseFloat(value || 0);
                    item.cif_fc = (inr / rate).toFixed(2);
                }
            }
        }
        updatedItems[index] = item;
        setData(prev => ({...prev, item_details: updatedItems}));
        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[`item_${index}_${field}`];
            return newErrors;
        });

        if (field === 'sr_number') {
            const srValue = value?.value;
            const count = updatedItems.filter(item => item.sr_number?.value === srValue).length;
            if (srValue && count > 1) {
                toast.warning('Duplicate SR number selected in another row');
            }
        }
    }, [data.exchange_rate, selectedSrNumbers]);

    const addItemRow = () => {
        setData(prev => ({
            ...prev,
            item_details: [
                ...prev.item_details,
                {
                    sr_number: null,
                    transaction_type: 'D',
                    qty: '',
                    cif_fc: '',
                    cif_inr: ''
                }
            ]
        }));
        setTimeout(() => lastRowRef.current?.focus(), 100);
    };

    const removeItemRow = (index) => {
        const updated = [...data.item_details];
        updated.splice(index, 1);

        // If empty after deletion, insert a blank row
        if (updated.length === 0) {
            updated.push({
                sr_number: null,
                transaction_type: 'D',
                qty: '',
                cif_fc: '',
                cif_inr: ''
            });
        }

        setData(prev => ({...prev, item_details: updated}));
    };

    useEffect(() => {
        if (!data.exchange_rate || isNaN(data.exchange_rate) || data.exchange_rate <= 0) return;

        const rate = parseFloat(data.exchange_rate);
        const updatedItems = data.item_details.map(item => {
            const fc = parseFloat(item.cif_fc || 0);
            const inr = parseFloat(item.cif_inr || 0);

            if (fc > 0) {
                return {...item, cif_inr: (fc * rate).toFixed(2)};
            } else if (inr > 0) {
                return {...item, cif_fc: (inr / rate).toFixed(2)};
            }
            return item;
        });

        setData(prev => ({...prev, item_details: updatedItems}));
    }, [data.exchange_rate]);

    const validate = () => {
        const errs = {};
        if (!data.bill_of_entry_number) errs.bill_of_entry_number = 'Required';
        if (!data.bill_of_entry_date) errs.bill_of_entry_date = 'Required';
        if (!data.company) errs.company = 'Required';
        if (!data.port) errs.port = 'Required';
        if (!data.product_name) errs.product_name = 'Required';
        if (!data.exchange_rate || isNaN(data.exchange_rate)) errs.exchange_rate = 'Enter valid number';

        data.item_details.forEach((item, idx) => {
            const srValue = item.sr_number?.value || item.sr_number_display?.value;
            if (!srValue) {
                errs[`item_${idx}_sr`] = 'License Number is required';
            }
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
                item_details: data.item_details.map((item) => ({
                    ...item,
                    sr_number: item.sr_number?.value || item.sr_number_display?.value || null
                }))
            };
            console.log(payload);
            if (isNew) {
                await axios.post('/api/bill-of-entries/', payload);
                toast.success('Bill of Entry Created');
            } else {
                await axios.patch(`/api/bill-of-entries/${data.id}/`, payload);
                toast.success('Bill of Entry Updated');
            }
            onSaved?.();
        } catch (err) {
            console.error(err);
            toast.error('Failed to save entry');
        } finally {
            setSaving(false);
        }
    };
    return (
        <Form>
            {Object.keys(errors).length > 0 && (
                console.log(errors),
                    <div className="alert alert-danger py-2 small">
                        <strong className="d-block mb-1">Please resolve the following validation issues:</strong>
                        <ul className="mb-0 ps-3">
                            {Object.entries(errors).map(([field, msg], i) => (
                                <li key={i}>
                                    <span className="text-capitalize">{field.replace(/_/g, ' ')}</span>: {msg}
                                </li>
                            ))}
                        </ul>
                    </div>
            )}

            <Row className="mb-3">
                <Col md={3}>
                    <Form.Label htmlFor="boe_number">BOE Number</Form.Label>
                    <Form.Control id="boe_number" name="boe_number" size="sm" value={data.bill_of_entry_number ?? ""}
                                  isInvalid={!!errors.bill_of_entry_number}
                                  onChange={(e) => handleChange('bill_of_entry_number', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.bill_of_entry_number}</Form.Control.Feedback>
                </Col>
                <Col md={3}>
                    <Form.Label htmlFor="boe_date">Date</Form.Label>
                    <Form.Control id="boe_date" name="boe_date" size="sm" type="date"
                                  value={data.bill_of_entry_date ?? ""}
                                  isInvalid={!!errors.bill_of_entry_date}
                                  onChange={(e) => handleChange('bill_of_entry_date', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.bill_of_entry_date}</Form.Control.Feedback>
                </Col>
                <Col md={3}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect value={data.company ?? ""} onChange={(v) => handleChange('company', v)}/>
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={3}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect value={data.port ?? ""} onChange={(v) => handleChange('port', v)}/>
                    {errors.port && <div className="text-danger small">{errors.port}</div>}
                </Col>
            </Row>
            <Row className="mb-3">
                <Col>
                    <Form.Label>Allotments</Form.Label>
                    <AsyncAllotmentSelect
                        value={data.allotment ?? []}
                        onChange={(v) => handleChange('allotment', v)}
                        currentBoeId={data.id}
                    />
                    {errors.allotment && <div className="text-danger small">{errors.allotment}</div>}
                </Col>
            </Row>
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label htmlFor="invoice_no">Invoice No</Form.Label>
                    <Form.Control id="invoice_no" name="invoice_no" size="sm" value={data.invoice_no ?? ""}
                                  isInvalid={!!errors.invoice_no}
                                  onChange={(e) => handleChange('invoice_no', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.invoice_no}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label htmlFor="product_name">Product Name</Form.Label>
                    <Form.Control id="product_name" name="product_name" size="sm" value={data.product_name ?? ""}
                                  isInvalid={!!errors.product_name}
                                  onChange={(e) => handleChange('product_name', e.target.value)}/>
                    <Form.Control.Feedback type="invalid">{errors.product_name}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label htmlFor="exchange_rate">Exchange Rate</Form.Label>
                    <Form.Control
                        id="exchange_rate"
                        name="exchange_rate"
                        size="sm"
                        type="number"
                        step="0.0001"
                        value={data.exchange_rate ?? ""}
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


            <LineItemTable
                items={data.item_details}
                errors={errors}
                selectedSrNumbers={selectedSrNumbers}
                onItemChange={handleItemChange}
                onAddRow={addItemRow}
                onRemoveRow={removeItemRow}
            />

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