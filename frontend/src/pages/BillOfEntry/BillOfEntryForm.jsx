import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncCompanySelect from './AsyncCompanySelect';
import AsyncPortSelect from './AsyncPortSelect';
import AsyncAllotmentSelect from './AsyncAllotmentSelect';
import LineItemTable from './LineItemTable';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';

const BillOfEntryForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [exchangeRateError, setExchangeRateError] = useState(false);
    const exchangeRateRef = useRef();

    const normalizeEntry = (entry) => ({
        ...entry,
        item_details: entry.item_details.map(item => ({
            ...item,
            sr_number: item.sr_number?.id
                ? {value: item.sr_number.id, label: item.sr_number.display_name}
                : null
        }))
    });

    const [data, setData] = useState(() => normalizeEntry(entry));

    const selectedSrNumbers = useMemo(
        () => data.item_details.map(item => item.sr_number?.value).filter(Boolean),
        [data.item_details]
    );

    const handleChange = useCallback((field, value) => {
        if (field === 'exchange_rate') {
            const rate = parseFloat(value || 0);
            if (!rate || rate <= 0) {
                setData(prev => ({...prev, exchange_rate: value}));
                return;
            }

            const updatedItems = data.item_details.map(item => {
                const cif_fc = parseFloat(item.cif_fc || 0);
                const cif_inr = parseFloat(item.cif_inr || 0);

                if (!cif_fc && cif_inr) {
                    return {...item, cif_fc: (cif_inr / rate).toFixed(2)};
                } else if (cif_fc && !cif_inr) {
                    return {...item, cif_inr: (cif_fc * rate).toFixed(2)};
                }
                return item;
            });

            setData(prev => ({
                ...prev,
                exchange_rate: value,
                item_details: updatedItems
            }));

            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors.exchange_rate;
                return newErrors;
            });
            return;
        }
        if (field === 'allotment') {
            const first = Array.isArray(value) && value.length > 0 ? value[0] : null;

            const newItems = value.flatMap(a =>
                (a.item_details || []).map(item => ({
                    sr_number: item.item
                        ? {value: item.item.id, label: item.item.display_name}
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

                const isEmptyOrSingleBlank = prev.item_details.length === 0 || (
                    prev.item_details.length === 1 &&
                    !prev.item_details[0].sr_number &&
                    !prev.item_details[0].qty &&
                    !prev.item_details[0].cif_fc &&
                    !prev.item_details[0].cif_inr
                );
                const baseItems = isEmptyOrSingleBlank ? [] : prev.item_details;

                const seen = new Set();
                const combinedItems = [...baseItems, ...newItems].filter(item => {
                    const id = item.sr_number?.value;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                return {
                    ...prev,
                    allotment: value,
                    product_name: combinedNames.join(', '),
                    company: prev.company || first?.company || null,
                    port: prev.port || first?.port || null,
                    item_details: combinedItems
                };
            });

            // Clear allotment error
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors.allotment;
                return newErrors;
            });
            return;
        }

        setData(prev => ({...prev, [field]: value}));
        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[field];
            return newErrors;
        });
    }, []);

    const handleItemChange = useCallback((index, field, value) => {
        if (field === 'sr_number') {
            value = value?.id
                ? {value: value.id, label: value.display_name}
                : value?.value && value.label
                    ? value
                    : null;
        }

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
            }
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

        setErrors(prev => {
            const newErrors = {...prev};
            delete newErrors[`item_${index}_${field}`];
            return newErrors;
        });
    }, [data.exchange_rate]);

    const addItemRow = () => {
        setData(prev => ({
            ...prev,
            item_details: [
                ...prev.item_details,
                {sr_number: null, transaction_type: 'D', qty: '', cif_fc: '', cif_inr: ''}
            ]
        }));
    };

    const removeItemRow = (index) => {
        const updated = [...data.item_details];
        updated.splice(index, 1);
        if (updated.length === 0) {
            updated.push({sr_number: null, transaction_type: 'D', qty: '', cif_fc: '', cif_inr: ''});
        }
        setData(prev => ({...prev, item_details: updated}));
    };

    const validate = () => {
        const errs = {};
        const srSeen = new Set();
        const srDuplicates = new Set();

        if (!data.bill_of_entry_number) errs.bill_of_entry_number = 'Required';
        if (!data.bill_of_entry_date) errs.bill_of_entry_date = 'Required';
        if (!data.company) errs.company = 'Required';
        if (!data.port) errs.port = 'Required';
        if (!data.product_name) errs.product_name = 'Required';
        if (!data.exchange_rate || isNaN(data.exchange_rate)) errs.exchange_rate = 'Enter valid number';

        data.item_details.forEach((item, idx) => {
            const srValue = item.sr_number?.value;
            if (!srValue) {
                errs[`item_${idx}_sr`] = 'License Number is required';
            } else {
                if (srSeen.has(srValue)) {
                    srDuplicates.add(srValue);
                }
                srSeen.add(srValue);
            }
            if (!item.qty || isNaN(item.qty)) errs[`item_${idx}_qty`] = 'Invalid';
            if (!item.cif_fc || isNaN(item.cif_fc)) errs[`item_${idx}_fc`] = 'Invalid';
            if (!item.cif_inr || isNaN(item.cif_inr)) errs[`item_${idx}_inr`] = 'Invalid';
        });

        if (srDuplicates.size > 0) {
            data.item_details.forEach((item, idx) => {
                if (srDuplicates.has(item.sr_number?.value)) {
                    errs[`item_${idx}_sr`] = 'Duplicate License Number selected';
                }
            });
        }

        setErrors(errs);

        // Auto-scroll to first invalid field
        if (Object.keys(errs).length > 0) {
            const firstErrorKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstErrorKey}"]`);
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                el.focus();
            }
        }

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
                allotment: data.allotment?.map(a => a.id) || [],
                item_details: data.item_details.map(item => ({
                    ...item,
                    sr_number: item.sr_number?.value || null
                }))
            };

            if (isNew) {
                await axios.post('/api/bill-of-entries/', payload);
                toast.success('Bill of Entry Created');
            } else {
                await axios.patch(`/api/bill-of-entries/${data.id}/`, payload);
                toast.success('Bill of Entry Updated');
            }
            onSaved?.({...data, id: data.id || 'new'});
        } catch (err) {
            console.error(err);
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
                    <Form.Control
                        size="sm"
                        value={data.bill_of_entry_number || ''}
                        isInvalid={!!errors.bill_of_entry_number}
                        onChange={(e) => handleChange('bill_of_entry_number', e.target.value)}
                        name="bill_of_entry_number"
                    />
                </Col>
                <Col md={3}>
                    <Form.Label>Date</Form.Label>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={data.bill_of_entry_date || ''}
                        isInvalid={!!errors.bill_of_entry_date}
                        onChange={(e) => handleChange('bill_of_entry_date', e.target.value)}
                        name="bill_of_entry_date"
                    />
                </Col>
                <Col md={3}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect
                        value={data.company}
                        onChange={(v) => handleChange('company', v)}
                    />
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={3}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect
                        value={data.port}
                        onChange={(v) => handleChange('port', v)}
                    />
                    {errors.port && <div className="text-danger small">{errors.port}</div>}
                </Col>
            </Row>

            <Row className="mb-3">
                <Col>
                    <Form.Label>Allotments</Form.Label>
                    <AsyncAllotmentSelect
                        value={data.allotment || []}
                        onChange={(v) => handleChange('allotment', v)}
                        currentBoeId={data.id}
                    />
                    {errors.allotment && <div className="text-danger small">{errors.allotment}</div>}
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Invoice No</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.invoice_no || ''}
                        isInvalid={!!errors.invoice_no}
                        onChange={(e) => handleChange('invoice_no', e.target.value)}
                        name="invoice_no"
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Product Name</Form.Label>
                    <Form.Control
                        size="sm"
                        value={data.product_name || ''}
                        isInvalid={!!errors.product_name}
                        onChange={(e) => handleChange('product_name', e.target.value)}
                        name="product_name"
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Exchange Rate</Form.Label>
                    <Form.Control
                        size="sm"
                        type="number"
                        step="0.0001"
                        value={data.exchange_rate || ''}
                        isInvalid={!!errors.exchange_rate || exchangeRateError}
                        ref={exchangeRateRef}
                        onChange={(e) => {
                            setExchangeRateError(false);
                            handleChange('exchange_rate', e.target.value);
                        }}
                        name="exchange_rate"
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
                {onClose && (
                    <Button variant="secondary" size="sm" className="ms-2" onClick={onClose}>
                        Cancel
                    </Button>
                )}
            </div>
        </Form>
    );
};

export default BillOfEntryForm;
