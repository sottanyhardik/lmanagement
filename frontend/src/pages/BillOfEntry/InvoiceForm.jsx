// src/pages/BOE/InvoiceForm.jsx
import React, {useEffect, useMemo, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import EntitySelect from '../../components/EntitySelect.jsx';
import {toast} from 'react-toastify';
import axios from '../../api/axiosInstance';
import ValidatedInput from '../../components/ValidatedInput';

const InvoiceForm = ({boe, onSaved}) => {
    const [loading, setLoading] = useState(true);

    // invoice picker
    const [invoiceList, setInvoiceList] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('NEW'); // "NEW" | id

    // core state
    const [entity, setEntity] = useState(null);            // { id, name? }
    const [toCompany, setToCompany] = useState({});
    const [billingMode, setBillingMode] = useState('kg');  // UI: 'kg' | 'cif_inr'
    const [items, setItems] = useState([]);
    const [invoice, setInvoice] = useState(null);
    const [invoiceDate, setInvoiceDate] = useState('');    // yyyy-mm-dd
    const [isEditing, setIsEditing] = useState(true);
    const [errors, setErrors] = useState({});

    // ---------- helpers ----------
    const computeTotals = (arr) => {
        const base = (arr || []).reduce(
            (acc, it) => ({
                qty: acc.qty + (Number(it?.qty) || 0),
                cif_fc: acc.cif_fc + (Number(it?.cif_fc) || 0),
                cif_inr: acc.cif_inr + (Number(it?.cif_inr) || 0),
                amount: acc.amount + (Number(it?.amount) || 0),
            }),
            {qty: 0, cif_fc: 0, cif_inr: 0, amount: 0}
        );
        return {
            qty: +base.qty.toFixed(2),
            cif_fc: +base.cif_fc.toFixed(2),
            cif_inr: +base.cif_inr.toFixed(2),
            amount: +base.amount.toFixed(2),
        };
    };

    const dataForTotals = useMemo(
        () => (invoice && !isEditing ? invoice.items : items) || [],
        [invoice, isEditing, items]
    );
    const totals = computeTotals(dataForTotals);

    // ---------- lifecycle: init ----------
    useEffect(() => {
        (async function init() {
            if (!boe) return setLoading(false);

            // default "to company" from BOE company (for NEW)
            setToCompany({
                id: boe.company?.id,
                name: boe.company?.name || '',
                address_line_1: boe.company?.address_line_1 || '',
                address_line_2: boe.company?.address_line_2 || '',
                pan: boe.company?.pan || '',
                gst_number: boe.company?.gst_number || '',
            });

            // default rows from BOE items (for NEW)
            const defaults = (boe.item_details || []).map((d) => ({
                sr_id: d?.sr_number?.id,
                license_no: (d?.sr_number?.display_name || '').split('-')[0].replace(/^0+/, ''),
                hsn_code: '490700',
                qty: Number(d?.qty) || 0,
                cif_fc: Number(d?.cif_fc) || 0,
                exchange_rate: Number(boe?.exchange_rate) || 0,
                cif_inr: Number(d?.cif_inr) || 0,
                rate: 0,
                amount: 0,
            }));
            setItems(defaults);

            // load invoice list & preselect latest (by date desc, fallback id desc)
            const list = (boe.invoices || []).slice().sort((a, b) => {
                const ad = new Date(a.invoice_date || 0).getTime();
                const bd = new Date(b.invoice_date || 0).getTime();
                if (ad !== bd) return bd - ad;
                return (b.id || 0) - (a.id || 0);
            });
            setInvoiceList(list);

            if (list.length) {
                // select latest to "show old invoice" capability immediately
                setSelectedInvoiceId(String(list[0].id));
            } else {
                // start in NEW mode
                setSelectedInvoiceId('NEW');
                setInvoice(null);
                setIsEditing(true);
                setInvoiceDate('');
                setBillingMode('kg');
            }

            setLoading(false);
        })();
    }, [boe]);

    // ---------- react to invoice selection ----------
    useEffect(() => {
        if (selectedInvoiceId === 'NEW') {
            // switch to NEW invoice create mode
            setInvoice(null);
            setIsEditing(true);
            setInvoiceDate('');
            setBillingMode('kg'); // default UI
            // keep toCompany as set from BOE; keep items built from BOE (already set on init)
            return;
        }

        // find chosen invoice and hydrate view/edit
        const inv = invoiceList.find((x) => String(x.id) === String(selectedInvoiceId));
        if (!inv) return;

        const mappedItems = (inv.items || []).map((it) => ({
            ...it,
            rate: Number(it?.rate || 0),
            amount: Number(it?.amount || 0),
            qty: Number(it?.qty || 0),
        }));

        setInvoice({...inv, items: mappedItems});
        setIsEditing(false); // VIEW old invoice
        setInvoiceDate(String(inv.invoice_date || '').slice(0, 10));
        setBillingMode(inv.billing_mode === 'kg' ? 'kg' : 'cif_inr'); // API 'cif' -> UI 'cif_inr'
        setEntity(inv.from_entity ? {id: inv.from_entity} : null);
        setToCompany({
            id: boe.company?.id,
            name: inv.to_company_name || '',
            address_line_1: inv.to_company_address_line_1 || '',
            address_line_2: inv.to_company_address_line_2 || '',
            pan: inv.to_company_pan || '',
            gst_number: inv.to_company_gst_number || '',
        });
        setItems(mappedItems);
    }, [selectedInvoiceId, invoiceList, boe]);

    // ---------- editing helpers ----------
    const handleItemChange = (idx, field, val) => {
        const arr = [...items];
        arr[idx][field] = Number(val);
        const rate = Number(arr[idx].rate || 0);
        arr[idx].amount =
            billingMode === 'kg'
                ? Number(arr[idx].qty || 0) * rate
                : (Number(arr[idx].cif_inr || 0) * rate) / 100;
        setItems(arr);
        validate();
    };

    const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const handleBillingModeChange = (mode) => {
        setBillingMode(mode);
        setItems((prev) =>
            prev.map((it) => {
                const r = Number(it.rate || 0);
                const amount = mode === 'kg' ? Number(it.qty || 0) * r : (Number(it.cif_inr || 0) * r) / 100;
                return {...it, amount};
            })
        );
    };

    // ---------- validate ----------
    const validate = () => {
        const newErrors = {};
        const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
        const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z{1}[0-9A-Z]{1}$/;

        const pan = (toCompany.pan || '').trim().toUpperCase();
        const gst = (toCompany.gst_number || '').trim().toUpperCase();

        if (!toCompany.name) newErrors.to_company_name = 'Company name is required.';
        if (!pan) newErrors.to_company_pan = 'PAN number is required.';
        else if (!PAN_REGEX.test(pan)) newErrors.to_company_pan = 'Invalid PAN format.';
        if (!gst) newErrors.to_company_gst = 'GST number is required.';
        else if (!GST_REGEX.test(gst)) newErrors.to_company_gst = 'Invalid GST format.';
        if (!entity?.id) newErrors.from_entity = 'From Company is required.';

        (items || []).forEach((it, idx) => {
            if (!Number.isFinite(Number(it?.rate))) {
                newErrors[`item_${idx}_rate`] = 'Valid rate is required.';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ---------- save / delete / pdf ----------
    const handleSave = async () => {
        if (!validate()) {
            toast.error('Please fix validation errors.');
            return;
        }
        try {
            const payload = {
                bills_of_entry: boe.id,
                from_entity: entity.id,                         // API expects 'from_entity'
                invoice_number: invoice?.invoice_number || '',
                invoice_date: invoiceDate || null,
                to_company: toCompany,                          // some BE accept nested
                to_company_name: toCompany.name,
                to_company_pan: toCompany.pan,
                to_company_gst_number: toCompany.gst_number,
                to_company_address_line_1: toCompany.address_line_1,
                to_company_address_line_2: toCompany.address_line_2,
                billing_mode: billingMode === 'kg' ? 'kg' : 'cif', // map to API
                items: (items || []).map((it) => ({
                    sr_number: it.sr_id || it.sr_number,
                    license_no: it.license_no,
                    hsn_code: it.hsn_code,
                    qty: it.qty,
                    cif_fc: it.cif_fc,
                    cif_inr: it.cif_inr,
                    rate: it.rate,
                    amount: +(+it.amount).toFixed(2),
                })),
                total_amount: totals.amount,
                total_qty: totals.qty,
                total_cif_fc: totals.cif_fc,
                total_cif_inr: totals.cif_inr,
            };

            const res = invoice?.id
                ? await axios.put(`invoices/${invoice.id}/`, payload)
                : await axios.post('invoices/', payload);

            const inv = res.data;
            inv.items = (inv.items || []).map((it) => ({
                ...it,
                rate: Number(it?.rate || 0),
                amount: Number(it?.amount || 0),
                qty: Number(it?.qty || 0),
            }));

            // refresh list: add/update selected invoice, then pick it
            setInvoiceList((prev) => {
                const exists = prev.some((x) => String(x.id) === String(inv.id));
                const next = exists ? prev.map((x) => (String(x.id) === String(inv.id) ? inv : x)) : [inv, ...prev];
                return next.sort((a, b) => {
                    const ad = new Date(a.invoice_date || 0).getTime();
                    const bd = new Date(b.invoice_date || 0).getTime();
                    if (ad !== bd) return bd - ad;
                    return (b.id || 0) - (a.id || 0);
                });
            });
            setSelectedInvoiceId(String(inv.id));

            setInvoice(inv);
            setIsEditing(false);
            setInvoiceDate(String(inv.invoice_date || '').slice(0, 10));
            toast.success('Invoice saved');
            onSaved && onSaved(boe.id);
        } catch (err) {
            const apiErrors = err.response?.data;
            console.error('Save invoice error:', apiErrors || err);

            const newErrors = {};
            if (apiErrors && typeof apiErrors === 'object') {
                for (const key in apiErrors) {
                    if (Array.isArray(apiErrors[key])) newErrors[key] = apiErrors[key].join(', ');
                    else if (typeof apiErrors[key] === 'object') {
                        for (const subKey in apiErrors[key]) {
                            const fullKey = `${key}_${subKey}`;
                            if (Array.isArray(apiErrors[key][subKey])) newErrors[fullKey] = apiErrors[key][subKey].join(', ');
                            else newErrors[fullKey] = apiErrors[key][subKey];
                        }
                    }
                }
            }
            setErrors(newErrors);
            toast.error('Save failed. Please check the form for issues.');
        }
    };

    const handleDelete = async () => {
        if (!invoice?.id) return toast.error('No invoice to delete.');
        if (!window.confirm('Are you sure you want to delete this invoice?')) return;

        try {
            await axios.delete(`invoices/${invoice.id}/`);
            toast.success('Invoice deleted');

            setInvoiceList((prev) => prev.filter((x) => String(x.id) !== String(invoice.id)));
            setSelectedInvoiceId('NEW'); // bounce to NEW mode

            setInvoice(null);
            setIsEditing(true);
            setInvoiceDate('');
            onSaved && onSaved(boe.id);
        } catch (err) {
            console.error('Delete invoice error:', err.response?.data || err);
            toast.error('Delete failed');
        }
    };

    const handleGenerate = async () => {
        if (!invoice?.id) return toast.error('Please save the invoice before generating the PDF.');
        try {
            const res = await axios.get(`invoices/${invoice.id}/pdf/`, {responseType: 'blob'});
            const blob = new Blob([res.data], {type: 'application/pdf'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoice.invoice_number || 'invoice'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Failed to download invoice PDF.');
        }
    };

    if (loading) return <Spinner/>;

    // ---------- VIEW ----------
    const ViewBlock = () => {
        const bmApi = invoice?.billing_mode === 'kg' ? 'kg' : 'cif';
        const showByKg = bmApi === 'kg';

        return (
            <div className="p-3 bg-light rounded">
                <Row className="mb-3 align-items-end">
                    <Col md={6}>
                        <Form.Label>Invoice</Form.Label>
                        <Form.Select
                            value={selectedInvoiceId}
                            onChange={(e) => setSelectedInvoiceId(e.target.value)}
                        >
                            <option value="NEW">+ Create New Invoice</option>
                            {invoiceList.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                    #{inv.invoice_number || inv.id} — {inv.to_company_name || '—'}
                                </option>
                            ))}
                        </Form.Select>
                    </Col>
                    <Col md="auto" className="text-end">
                        <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
                        <Button className="ms-2" onClick={handleGenerate}>Download PDF</Button>
                        <Button className="ms-2 btn-danger" onClick={handleDelete}>Delete</Button>
                    </Col>
                </Row>

                <h5 className="text-danger">Invoice #: {invoice?.invoice_number || '—'}</h5>
                <p><strong>Date:</strong> {invoiceDate || '—'}</p>

                <Row className="mb-2">
                    <Col md={6}>
                        <h6>From Entity</h6>
                        <div>{entity?.name || (entity?.id ? `ID: ${entity.id}` : '—')}</div>
                    </Col>
                    <Col md={6}>
                        <h6>To Company</h6>
                        <div>{toCompany?.name || '—'}</div>
                        <div>PAN: {invoice?.to_company_pan || '—'} | GST: {invoice?.to_company_gst_number || '—'}</div>
                        <div>{invoice?.to_company_address_line_1 || '—'}</div>
                        <div>{invoice?.to_company_address_line_2 || ''}</div>
                    </Col>
                </Row>

                <Table bordered size="sm" className="mt-3">
                    <thead>
                    <tr>
                        <th>#</th>
                        <th>License</th>
                        {showByKg ? (
                            <>
                                <th>Qty</th>
                                <th>Rate</th>
                                <th>Amount</th>
                            </>
                        ) : (
                            <>
                                <th>CIF $</th>
                                <th>CIF INR</th>
                                <th>Billing %</th>
                                <th>Amount</th>
                            </>
                        )}
                    </tr>
                    </thead>
                    <tbody>
                    {(invoice?.items || []).map((it, idx) => (
                        <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{it.license_no}</td>
                            {showByKg ? (
                                <>
                                    <td>{it.qty}</td>
                                    <td>{it.rate}</td>
                                    <td>{Number(it.amount || 0).toFixed(2)}</td>
                                </>
                            ) : (
                                <>
                                    <td>{it.cif_fc}</td>
                                    <td>{it.cif_inr}</td>
                                    <td>{it.rate}</td>
                                    <td>{Number(it.amount || 0).toFixed(2)}</td>
                                </>
                            )}
                        </tr>
                    ))}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={2}><strong>Total</strong></td>
                        {showByKg ? (
                            <>
                                <td><strong>{totals.qty}</strong></td>
                                <td/>
                                <td><strong>{totals.amount}</strong></td>
                            </>
                        ) : (
                            <>
                                <td><strong>{totals.cif_fc}</strong></td>
                                <td><strong>{totals.cif_inr}</strong></td>
                                <td/>
                                <td><strong>{totals.amount}</strong></td>
                            </>
                        )}
                    </tr>
                    </tfoot>
                </Table>
            </div>
        );
    };

    // ---------- EDIT ----------
    const EditBlock = () => (
        <Form className="p-3 bg-light rounded">
            {/* Invoice selector */}
            <Row className="mb-3 align-items-end">
                <Col md={6}>
                    <Form.Label>Invoice</Form.Label>
                    <Form.Select
                        value={selectedInvoiceId}
                        onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    >
                        <option value="NEW">+ Create New Invoice</option>
                        {invoiceList.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                                #{inv.invoice_number || inv.id} — {inv.to_company_name || '—'}
                            </option>
                        ))}
                    </Form.Select>
                </Col>
                <Col md="auto" className="text-end">
                    <Button variant="outline-primary" onClick={() => setSelectedInvoiceId('NEW')}>New</Button>
                </Col>
            </Row>

            {/* From entity + meta */}
            <Form.Group className="mb-3">
                <Form.Label>From Company</Form.Label>
                <div className={errors.from_entity ? 'border border-danger rounded p-2' : ''}>
                    <EntitySelect
                        value={entity}
                        onChange={(val) => {
                            setEntity(val);
                            setTimeout(validate, 0);
                        }}
                    />
                    {errors.from_entity && <div className="text-danger small mt-1">{errors.from_entity}</div>}
                </div>

                <Row className="mt-3">
                    <Col md={6}>
                        <ValidatedInput
                            label="Invoice Number (optional)"
                            value={invoice?.invoice_number || ''}
                            onChange={(e) => setInvoice((p) => ({...(p || {}), invoice_number: e.target.value}))}
                            placeholder="Leave blank to auto-generate"
                            error={errors.invoice_number}
                        />
                    </Col>
                    <Col md={6}>
                        <Form.Label>Invoice Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            isInvalid={!!errors.invoice_date}
                        />
                        <Form.Control.Feedback type="invalid">{errors.invoice_date}</Form.Control.Feedback>
                    </Col>
                </Row>
            </Form.Group>

            {/* To company */}
            <Row className="mb-3">
                <Col md={4}>
                    <ValidatedInput
                        label="To Company"
                        value={toCompany.name || ''}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, name: val}));
                            setTimeout(validate, 0);
                        }}
                        placeholder="Enter Company Name"
                        error={errors.to_company_name}
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="PAN"
                        value={toCompany.pan || ''}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, pan: val}));
                            setTimeout(validate, 0);
                        }}
                        placeholder="Enter PAN Number"
                        error={errors.to_company_pan}
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="GST"
                        value={toCompany.gst_number || ''}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, gst_number: val}));
                            setTimeout(validate, 0);
                        }}
                        placeholder="Enter GST Number"
                        error={errors.to_company_gst}
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="Address Line 1"
                        value={toCompany.address_line_1 || ''}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, address_line_1: val}));
                            setTimeout(validate, 0);
                        }}
                        placeholder="Enter Address Line 1.."
                        error={errors.address_line_1}
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="Address Line 2"
                        value={toCompany.address_line_2 || ''}
                        onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setToCompany((prev) => ({...prev, address_line_2: val}));
                            setTimeout(validate, 0);
                        }}
                        placeholder="Enter Address Line 2.."
                        error={errors.address_line_2}
                    />
                </Col>
            </Row>

            {/* Billing mode */}
            <Form.Group className="mb-3">
                <Form.Label>Billing Mode</Form.Label><br/>
                <Form.Check
                    inline
                    type="radio"
                    label="By KG"
                    checked={billingMode === 'kg'}
                    onChange={() => handleBillingModeChange('kg')}
                />
                <Form.Check
                    inline
                    type="radio"
                    label="By CIF INR (%)"
                    checked={billingMode === 'cif_inr'}
                    onChange={() => handleBillingModeChange('cif_inr')}
                />
            </Form.Group>

            {/* Lines */}
            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>#</th>
                    <th>License</th>
                    <th>HSN</th>
                    {billingMode === 'kg' ? (
                        <th>Qty</th>
                    ) : (
                        <>
                            <th>CIF $</th>
                            <th>Exc Rate</th>
                            <th>CIF INR</th>
                        </>
                    )}
                    <th>{billingMode === 'kg' ? 'Rate ₹/kg' : 'Billing %'}</th>
                    <th>Amount ₹</th>
                    <th/>
                </tr>
                </thead>
                <tbody>
                {(items || []).map((it, idx) => (
                    <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{it.license_no}</td>
                        <td>{it.hsn_code}</td>
                        {billingMode === 'kg' ? (
                            <td>{it.qty}</td>
                        ) : (
                            <>
                                <td>{it.cif_fc}</td>
                                <td>{it.exchange_rate}</td>
                                <td>{it.cif_inr}</td>
                            </>
                        )}
                        <td>
                            <Form.Control
                                type="number"
                                step="0.01"
                                size="sm"
                                value={it.rate}
                                onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            />
                        </td>
                        <td>{Number(it.amount || 0).toFixed(2)}</td>
                        <td>
                            <Button size="sm" variant="danger" onClick={() => removeItem(idx)}>✖</Button>
                        </td>
                    </tr>
                ))}
                </tbody>
                <tfoot>
                <tr>
                    <td colSpan={3}><strong>Total</strong></td>
                    {billingMode === 'kg' ? (
                        <>
                            <td>{totals.qty}</td>
                            <td>-</td>
                            <td>{totals.amount}</td>
                        </>
                    ) : (
                        <>
                            <td>{totals.cif_fc}</td>
                            <td/>
                            <td>{totals.cif_inr}</td>
                            <td/>
                            <td>{totals.amount}</td>
                        </>
                    )}
                    <td/>
                </tr>
                </tfoot>
            </Table>

            <Button
                size="sm"
                onClick={() => setItems((prev) => [...prev, {...(prev[0] || {}), rate: 0, amount: 0}])}
            >
                Add Row
            </Button>

            <hr/>
            <Button onClick={handleSave}>Save Invoice</Button>
            {invoice && <Button className="ms-2" onClick={() => setIsEditing(false)}>Cancel</Button>}
            {invoice && <Button className="ms-2" onClick={handleGenerate}>Download PDF</Button>}
        </Form>
    );

    return isEditing ? <EditBlock/> : <ViewBlock/>;
};

export default InvoiceForm;
