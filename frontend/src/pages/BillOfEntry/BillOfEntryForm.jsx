import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Col, Form, Row} from 'react-bootstrap';
import AsyncCompanySelect from '../../components/AsyncSelect/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncSelect/AsyncPortSelect';
import AsyncAllotmentSelect from '../../components/AsyncSelect/AsyncAllotmentSelect';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import LineItemTable from './LineItemTable';

const emptyRow = () => ({
    sr_number: null, // normalized as {value,label} | null
    transaction_type: 'D',
    qty: '',
    cif_fc: '',
    cif_inr: '',
});

/** Normalize any SR shape into {value, label} */
function toSrOption(sr) {
    if (!sr) return null;
    if (typeof sr === 'number') return {value: sr, label: String(sr)};
    if (typeof sr === 'object') {
        if ('value' in sr) return sr;
        if ('id' in sr) return {value: sr.id, label: sr.display_name ?? String(sr.id)};
    }
    return null;
}

const BillOfEntryForm = ({entry, isNew = false, onClose, onSaved}) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [exchangeRateError, setExchangeRateError] = useState(false);
    const exchangeRateRef = useRef();
    const lastRowRef = useRef();

    // Normalize initial entry
    const [data, setData] = useState(() => {
        const e = entry ?? {};
        const items = Array.isArray(e.item_details) ? e.item_details : [];
        return {
            ...e,
            item_details: items.length
                ? items.map((it) => ({
                    ...emptyRow(),
                    ...it,
                    sr_number: toSrOption(it.sr_number),
                    transaction_type: it.transaction_type || 'D',
                    qty: it.qty ?? '',
                    cif_fc: it.cif_fc ?? '',
                    cif_inr: it.cif_inr ?? '',
                }))
                : [emptyRow()],
            allotment: Array.isArray(e.allotment) ? e.allotment : [],
            company: e.company ?? null,
            port: e.port ?? null,
            invoice_no: e.invoice_no ?? '',
            product_name: e.product_name ?? '',
            exchange_rate: e.exchange_rate ?? '',
            bill_of_entry_number: e.bill_of_entry_number ?? '',
            bill_of_entry_date: e.bill_of_entry_date ?? '',
        };
    });

    const selectedSrNumbers = useMemo(
        () =>
            (data.item_details || [])
                .map((r) => r.sr_number?.value ?? r.sr_number?.id)
                .filter(Boolean),
        [data.item_details]
    );

    const handleChange = useCallback((field, value) => {
        if (field === 'allotment') {
            const first = Array.isArray(value) && value.length ? value[0] : null;

            const newItemsFromAllotments = (value || []).flatMap((a) =>
                (a.item_details || []).map((item) => ({
                    sr_number: item.item ? {value: item.item.id, label: item.item.display_name} : null,
                    transaction_type: item.transaction_type || 'D',
                    qty: item.qty ?? '',
                    cif_fc: item.cif_fc ?? '',
                    cif_inr: item.cif_inr ?? '',
                }))
            );

            setData((prev) => {
                const prevNames = prev.product_name
                    ? prev.product_name.split(',').map((n) => n.trim()).filter(Boolean)
                    : [];
                const newNames = (value || []).map((a) => a.item_name).filter(Boolean);
                const product_name = Array.from(new Set([...prevNames, ...newNames])).join(', ');

                const isEmptyOrSingleBlank =
                    prev.item_details.length === 0 ||
                    (prev.item_details.length === 1 &&
                        !prev.item_details[0].sr_number &&
                        !prev.item_details[0].qty &&
                        !prev.item_details[0].cif_fc &&
                        !prev.item_details[0].cif_inr);

                const base = isEmptyOrSingleBlank ? [] : prev.item_details;

                const seen = new Set();
                const merged = [...base, ...newItemsFromAllotments].filter((row) => {
                    const id = row.sr_number?.value ?? row.sr_number?.id;
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                return {
                    ...prev,
                    allotment: value,
                    product_name,
                    company: prev.company || first?.company || null,
                    port: prev.port || first?.port || null,
                    item_details: merged.length ? merged : [emptyRow()],
                };
            });

            setErrors((prev) => {
                const copy = {...prev};
                delete copy[field];
                return copy;
            });
            return;
        }

        setData((prev) => ({...prev, [field]: value}));
        setErrors((prev) => {
            const copy = {...prev};
            delete copy[field];
            return copy;
        });
    }, []);

    const handleItemChange = useCallback(
        (index, field, value) => {
            const updatedItems = [...data.item_details];

            // Normalize SR value on change
            const normalized =
                field === 'sr_number'
                    ? value
                        ? 'value' in value
                            ? value
                            : {
                                value: value.id ?? value.value,
                                label: value.label ?? value.display_name ?? String(value.id ?? value.value ?? '')
                            }
                        : null
                    : value;

            const row = {...updatedItems[index], [field]: normalized};
            const rate = parseFloat(data.exchange_rate || 0);

            // Only auto-fill the counterpart if it's blank; never overwrite user input.
            if (field === 'cif_fc') {
                if ((row.cif_inr === '' || row.cif_inr == null) && value !== '') {
                    if (!rate || rate <= 0) {
                        toast.warning('Please enter a valid Exchange Rate first');
                        setExchangeRateError(true);
                        exchangeRateRef.current?.focus();
                    } else {
                        setExchangeRateError(false);
                        const fcNum = parseFloat(value);
                        if (Number.isFinite(fcNum)) row.cif_inr = (fcNum * rate).toFixed(2);
                    }
                }
            }
            if (field === 'cif_inr') {
                if ((row.cif_fc === '' || row.cif_fc == null) && value !== '') {
                    if (!rate || rate <= 0) {
                        toast.warning('Please enter a valid Exchange Rate first');
                        setExchangeRateError(true);
                        exchangeRateRef.current?.focus();
                    } else {
                        setExchangeRateError(false);
                        const inrNum = parseFloat(value);
                        if (Number.isFinite(inrNum) && rate) row.cif_fc = (inrNum / rate).toFixed(4);
                    }
                }
            }

            updatedItems[index] = row;
            setData((prev) => ({...prev, item_details: updatedItems}));

            setErrors((prev) => {
                const copy = {...prev};
                delete copy[`item_${index}_${field}`];
                return copy;
            });

            if (field === 'sr_number') {
                const srVal = normalized?.value ?? normalized?.id;
                const dupCount = updatedItems.filter((r) => (r.sr_number?.value ?? r.sr_number?.id) === srVal).length;
                if (srVal && dupCount > 1) toast.warning('Duplicate SR number selected in another row');
            }
        },
        [data.exchange_rate, data.item_details]
    );

    const addItemRow = () => {
        setData((prev) => ({...prev, item_details: [...prev.item_details, emptyRow()]}));
        setTimeout(() => lastRowRef.current?.focus?.(), 100);
    };

    const removeItemRow = (index) => {
        const updated = [...data.item_details];
        updated.splice(index, 1);
        if (!updated.length) updated.push(emptyRow());
        setData((prev) => ({...prev, item_details: updated}));
    };

    // When rate changes, only back-fill the missing counterpart; don't overwrite existing values.
    useEffect(() => {
        const rate = parseFloat(data.exchange_rate);
        if (!rate || rate <= 0) return;
        const updated = (data.item_details || []).map((row) => {
            const hasFC = row.cif_fc !== '' && row.cif_fc != null;
            const hasINR = row.cif_inr !== '' && row.cif_inr != null;
            if (hasFC && !hasINR) {
                const fcNum = parseFloat(row.cif_fc);
                if (Number.isFinite(fcNum)) return {...row, cif_inr: (fcNum * rate).toFixed(2)};
            }
            if (!hasFC && hasINR) {
                const inrNum = parseFloat(row.cif_inr);
                if (Number.isFinite(inrNum)) return {...row, cif_fc: (inrNum / rate).toFixed(4)};
            }
            return row; // both blank or both filled -> leave as-is
        });
        setData((prev) => ({...prev, item_details: updated}));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.exchange_rate]);

    // ------------------------- Validation & Save -------------------------
    const validate = () => {
        const errs = {};
        const items = data.item_details || [];

        if (!data.bill_of_entry_number) errs.bill_of_entry_number = 'Required';
        if (!data.bill_of_entry_date) errs.bill_of_entry_date = 'Required';
        if (!data.company) errs.company = 'Required';
        if (!data.port) errs.port = 'Required';
        if (!data.product_name) errs.product_name = 'Required';

        const rateOk = data.exchange_rate !== '' && !Number.isNaN(parseFloat(data.exchange_rate));
        if (!rateOk) errs.exchange_rate = 'Enter valid number';

        items.forEach((row, idx) => {
            const srValue = row.sr_number?.value ?? row.sr_number?.id;
            if (!srValue) errs[`item_${idx}_sr`] = 'License Number is required';

            const qtyOk = row.qty !== '' && Number.isFinite(parseFloat(row.qty));
            if (!qtyOk) errs[`item_${idx}_qty`] = 'Invalid';

            const fcOk = row.cif_fc !== '' && Number.isFinite(parseFloat(row.cif_fc));
            if (!fcOk) errs[`item_${idx}_fc`] = 'Invalid';

            const inrOk = row.cif_inr !== '' && Number.isFinite(parseFloat(row.cif_inr));
            if (!inrOk) errs[`item_${idx}_inr`] = 'Invalid';
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
            // Build clean payload (PKs + numbers only)
            const payload = {
                company: data.company?.id ?? data.company,
                bill_of_entry_number: data.bill_of_entry_number,
                bill_of_entry_date: data.bill_of_entry_date,
                port: data.port?.id ?? data.port,
                exchange_rate: data.exchange_rate === '' ? null : Number(data.exchange_rate),
                product_name: data.product_name,
                allotment: (data.allotment || []).map((a) => a?.id ?? a).filter(Boolean),
                invoice_no: data.invoice_no || '',
                item_details: (data.item_details || []).map((row) => ({
                    sr_number: row.sr_number?.value ?? row.sr_number?.id ?? null, // PK
                    qty: row.qty === '' ? null : Number(row.qty),
                    cif_fc: row.cif_fc === '' ? null : Number(row.cif_fc),
                    cif_inr: row.cif_inr === '' ? null : Number(row.cif_inr),
                    transaction_type: row.transaction_type || 'D',
                })),
            };

            if (isNew) {
                await axios.post('bill-of-entries/', payload);
                toast.success('Bill of Entry Created');
            } else {
                await axios.patch(`bill-of-entries/${data.id}/`, payload);
                toast.success('Bill of Entry Updated');
            }
            onSaved?.();
        } catch (err) {
            console.error('[BOE save] error:', err?.response?.data || err);
            const detail = err?.response?.data;
            if (detail) {
                const firstKey = Object.keys(detail)[0];
                toast.error(
                    typeof detail === 'string'
                        ? detail
                        : `${firstKey}: ${Array.isArray(detail[firstKey]) ? detail[firstKey][0] : JSON.stringify(detail[firstKey])}`
                );
            } else {
                toast.error('Failed to save entry');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form>
            {Object.keys(errors).length > 0 && (
                <>
                    {console.log(errors)}
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
                </>
            )}

            <Row className="mb-3">
                <Col md={3}>
                    <Form.Label htmlFor="boe_number">BOE Number</Form.Label>
                    <Form.Control
                        id="boe_number"
                        name="boe_number"
                        size="sm"
                        value={data.bill_of_entry_number ?? ''}
                        isInvalid={!!errors.bill_of_entry_number}
                        onChange={(e) => handleChange('bill_of_entry_number', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.bill_of_entry_number}</Form.Control.Feedback>
                </Col>
                <Col md={3}>
                    <Form.Label htmlFor="boe_date">Date</Form.Label>
                    <Form.Control
                        id="boe_date"
                        name="boe_date"
                        size="sm"
                        type="date"
                        value={data.bill_of_entry_date ?? ''}
                        isInvalid={!!errors.bill_of_entry_date}
                        onChange={(e) => handleChange('bill_of_entry_date', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.bill_of_entry_date}</Form.Control.Feedback>
                </Col>
                <Col md={3}>
                    <Form.Label>Company</Form.Label>
                    <AsyncCompanySelect value={data.company ?? ''} onChange={(v) => handleChange('company', v)}/>
                    {errors.company && <div className="text-danger small">{errors.company}</div>}
                </Col>
                <Col md={3}>
                    <Form.Label>Port</Form.Label>
                    <AsyncPortSelect value={data.port ?? ''} onChange={(v) => handleChange('port', v)}/>
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
                    <Form.Control
                        id="invoice_no"
                        name="invoice_no"
                        size="sm"
                        value={data.invoice_no ?? ''}
                        isInvalid={!!errors.invoice_no}
                        onChange={(e) => handleChange('invoice_no', e.target.value)}
                    />
                    <Form.Control.Feedback type="invalid">{errors.invoice_no}</Form.Control.Feedback>
                </Col>
                <Col md={4}>
                    <Form.Label htmlFor="product_name">Product Name</Form.Label>
                    <Form.Control
                        id="product_name"
                        name="product_name"
                        size="sm"
                        value={data.product_name ?? ''}
                        isInvalid={!!errors.product_name}
                        onChange={(e) => handleChange('product_name', e.target.value)}
                    />
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
                        value={data.exchange_rate ?? ''}
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
                lastRowRef={lastRowRef}
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
