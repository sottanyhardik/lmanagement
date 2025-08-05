import React, {useEffect, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import EntitySelect from './EntitySelect.jsx';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import ValidatedInput from '../../components/ValidatedInput';

const InvoiceForm = ({boe, onSaved}) => {
    const [loading, setLoading] = useState(true);
    const [entity, setEntity] = useState(null);
    const [fromCompany, setFromCompany] = useState({});
    const [toCompany, setToCompany] = useState({});
    const [billingMode, setBillingMode] = useState('kg');
    const [items, setItems] = useState([]);
    const [invoice, setInvoice] = useState(null);
    const [isEditing, setIsEditing] = useState(true);
    const [errors, setErrors] = useState({});

    // Load BOE and existing invoice
    useEffect(() => {
        async function init() {
            if (!boe) return setLoading(false);

            setToCompany({
                id: boe.company.id,
                name: boe.company.name || '',
                address_line_1: boe.company.address_line_1 || '',
                address_line_2: boe.company.address_line_2 || '',
                pan: boe.company.pan || '',
                gst_number: boe.company.gst_number || ''
            });
            validate();
            const defaultItems = boe.item_details.map(d => ({
                sr_id: d.sr_number.id,
                license_no: d.sr_number.display_name.split('-')[0].replace(/^0+/, ''),
                hsn_code: '490700',
                qty: Number(d.qty),
                cif_fc: Number(d.cif_fc),
                exchange_rate: Number(boe.exchange_rate),
                cif_inr: Number(d.cif_inr),
                rate: 0,
                amount: 0
            }));
            setItems(defaultItems);
            try {
                const arr = boe.invoices || [];
                if (arr.length > 0) {
                    const inv = arr[0];
                    inv.items = inv.items.map(it => ({
                        ...it,
                        rate: Number(it.rate || 0),
                        amount: Number(it.amount || 0),
                        qty: Number(it.qty || 0)
                    }));
                    setInvoice(inv);
                    setIsEditing(false);
                    setBillingMode(inv.billing_mode);
                    setEntity(inv.from_entity);
                    setFromCompany(inv.from_entity);
                    setItems(inv.items);
                    setToCompany({
                        id: boe.company.id,
                        name: inv.to_company_name || '',
                        address_line_1: inv.to_company_address_line_1 || '',
                        address_line_2: inv.to_company_address_line_2 || '',
                        pan: inv.to_company_pan || '',
                        gst_number: inv.to_company_gst_number || ''
                    });
                }
            } catch (err) {
                console.error('Fetch invoice error:', err);
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [boe]);


    const computeTotals = arr => {
        const result = arr.reduce((acc, it) => ({
            qty: acc.qty + (Number(it.qty) || 0),
            cif_fc: acc.cif_fc + (Number(it.cif_fc) || 0),
            cif_inr: acc.cif_inr + (Number(it.cif_inr) || 0),
            amount: acc.amount + (Number(it.amount) || 0)
        }), {
            qty: 0,
            cif_fc: 0,
            cif_inr: 0,
            amount: 0
        });

        return {
            qty: parseFloat(result.qty.toFixed(2)),
            cif_fc: parseFloat(result.cif_fc.toFixed(2)),
            cif_inr: parseFloat(result.cif_inr.toFixed(2)),
            amount: parseFloat(result.amount.toFixed(2))
        };
    };
    const dataForTotals = invoice && !isEditing ? invoice.items : items;
    const totals = computeTotals(dataForTotals || []);

    const handleItemChange = (idx, field, val) => {
        const arr = [...items];
        arr[idx][field] = Number(val);
        console.log(arr[idx].rate)
        const rate = arr[idx].rate || 0;
        arr[idx].amount = billingMode === 'kg'
            ? arr[idx].qty * rate
            : (arr[idx].cif_inr * rate) / 100;
        setItems(arr);
        validate();
    };
    const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx));
    const validate = () => {
        const newErrors = {};
        const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
        const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
        if (!toCompany.name) newErrors.to_company_name = 'Company name is required.';
        if (!toCompany.pan) {
            newErrors.to_company_pan = 'PAN number is required.';
        } else if (!PAN_REGEX.test(toCompany.pan.toUpperCase())) {
            newErrors.to_company_pan = 'Invalid PAN format.';
        }

        if (!toCompany.gst_number) {
            newErrors.to_company_gst = 'GST number is required.';
        } else if (!GST_REGEX.test(toCompany.gst_number.toUpperCase())) {
            newErrors.to_company_gst = 'Invalid GST format.';
        }

        if (!entity?.id) newErrors.from_entity = 'From Company is required.';

        items.forEach((it, idx) => {
            if (!it.rate || isNaN(it.rate)) {
                newErrors[`item_${idx}_rate`] = 'Valid rate is required.';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSave = async () => {
        if (!validate()) {
            toast.error('Please fix validation errors.');
            return;
        }
        try {
            const payload = {
                bills_of_entry_id: boe.id,
                from_entity_id: entity.id,
                to_company: toCompany,
                to_company_name: toCompany.name,
                to_company_pan: toCompany.pan,
                to_company_gst_number: toCompany.gst_number,
                to_company_address_line_1: toCompany.address_line_1,
                to_company_address_line_2: toCompany.address_line_2,
                billing_mode: billingMode,
                items: items.map(it => ({
                    sr_number: it.sr_id || it.sr_number,
                    license_no: it.license_no,
                    hsn_code: it.hsn_code,
                    qty: it.qty,
                    cif_fc: it.cif_fc,
                    cif_inr: it.cif_inr,
                    rate: it.rate,
                    amount: parseFloat(parseFloat(it.amount).toFixed(2))
                })),
                'total_amount': totals.amount,
                'total_qty': totals.qty,
                'total_cif_fc': totals.cif_fc,
                'total_cif_inr': totals.cif_inr,

            };
            console.log(payload);
            let res;
            if (invoice?.id) {
                // Update existing invoice
                res = await axios.put(`/api/invoices/${invoice.id}/`, payload);
            } else {
                // Create new invoice
                res = await axios.post('/api/invoices/', payload);
            }
            const inv = res.data;
            inv.items = inv.items.map(it => ({
                ...it,
                rate: Number(it.rate || 0),
                amount: Number(it.amount || 0),
                qty: Number(it.qty || 0)
            }));
            setInvoice(inv);
            setIsEditing(false);
            toast.success('Invoice saved');
            if (onSaved) onSaved(boe.id);
        } catch (err) {
            const apiErrors = err.response?.data;
            console.error('Save invoice error:', apiErrors || err);

            // Flatten Django-style nested errors to match our field names
            const newErrors = {};
            if (apiErrors && typeof apiErrors === 'object') {
                for (const key in apiErrors) {
                    if (Array.isArray(apiErrors[key])) {
                        newErrors[key] = apiErrors[key].join(', ');
                    } else if (typeof apiErrors[key] === 'object') {
                        for (const subKey in apiErrors[key]) {
                            const fullKey = `${key}_${subKey}`;
                            if (Array.isArray(apiErrors[key][subKey])) {
                                newErrors[fullKey] = apiErrors[key][subKey].join(', ');
                            } else {
                                newErrors[fullKey] = apiErrors[key][subKey];
                            }
                        }
                    }
                }
            }

            setErrors(newErrors);
            toast.error('Save failed. Please check the form for issues.');
        }
    };
    const handleDelete = async () => {
        if (!invoice?.id) {
            toast.error('No invoice to delete.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this invoice?')) return;

        try {
            await axios.delete(`/api/invoices/${invoice.id}/`);
            toast.success('Invoice deleted');
            setInvoice(null);
            setIsEditing(true);
            if (onSaved) onSaved(boe.id);
        } catch (err) {
            console.error('Delete invoice error:', err.response?.data || err);
            toast.error('Delete failed');
        }
    };
    const handleBillingModeChange = mode => {
        setBillingMode(mode);
        setItems(prev => prev.map(it => {
            const rate = parseFloat(it.rate || 0);
            const amount = mode === 'kg' ? it.qty * rate : (it.cif_inr * rate) / 100;
            return {...it, amount};
        }));
    };

    const handleGenerate = () => {
        if (!invoice?.id) {
            toast.error('Please save the invoice before generating the PDF.');
            return;
        }

        const url = `/api/invoices/${invoice.id}/pdf/`;
        const filename = `${invoice.invoice_number || 'invoice'}.pdf`;

        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        link.setAttribute('target', '_blank');  // Optional: open in new tab
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link); // Clean up
    };
    if (loading) return <Spinner/>;

    if (!isEditing && invoice) {
        return (
            <div className="p-3 bg-light rounded">
                <h5 className="text-danger">Invoice #: {invoice.invoice_number}</h5>
                <p><strong>Date:</strong> {invoice.invoice_date}</p>

                <Row>
                    <Col md={6}>
                        <h6>From Entity</h6>
                        <div>{fromCompany.name}</div>
                        <div>PAN: {fromCompany.pan_number} | GST: {fromCompany.gst_number}</div>
                    </Col>
                    <Col md={6}>
                        <h6>To Company</h6>
                        <div>{toCompany.name}</div>
                        <div>PAN: {invoice.to_company_pan} | GST: {invoice.to_company_gst_number}</div>
                    </Col>
                </Row>

                <Table bordered size="sm" className="mt-3">
                    <thead>
                    <tr>
                        <th>#</th>
                        <th>License</th>
                        {invoice.billing_mode === 'kg' ? (
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
                    {invoice.items.map((it, idx) => (
                        <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{it.license_no}</td>
                            {invoice.billing_mode === 'kg' ? (
                                <>
                                    <td>{it.qty}</td>
                                    <td>{it.rate}</td>
                                    <td>{Number(it.amount).toFixed(2)}</td>
                                </>
                            ) : (
                                <>
                                    <td>{it.cif_fc}</td>
                                    <td>{it.cif_inr}</td>
                                    <td>{it.rate}</td>
                                    <td>{Number(it.amount).toFixed(2)}</td>
                                </>
                            )}
                        </tr>
                    ))}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={2}><strong>Total</strong></td>
                        {invoice.billing_mode === 'kg' ? (
                            <>
                                <td><strong>{totals.qty}</strong></td>
                                <td></td>
                                <td><strong>{totals.amount}</strong></td>
                            </>
                        ) : (
                            <>
                                <td><strong>{totals.cif_fc}</strong></td>
                                <td><strong>{totals.cif_inr}</strong></td>
                                <td></td>
                                <td><strong>{totals.amount}</strong></td>
                            </>
                        )}
                    </tr>
                    </tfoot>
                </Table>


                <Button onClick={() => setIsEditing(true)}>Edit Invoice</Button>
                <Button className="ms-2" onClick={handleGenerate}>Download Invoice</Button>
                <Button className="ms-2 btn-danger" onClick={handleDelete}>Delete Invoice</Button> {/* ✅ NEW */}
            </div>
        );
    }

    // Render edit form if editing or no invoice exists
    return (
        <Form className="p-3 bg-light rounded">
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
            <Form.Group className="mb-3">
                <Form.Label>From Company</Form.Label>
                <EntitySelect value={entity} onChange={setEntity}/>
                {fromCompany.name && (
                    <div className="d-flex justify-content-between align-items-start border rounded p-4 bg-white">
                        {/* Left: Company Details */}
                        <div style={{maxWidth: '70%'}}>
                            <h5 className="text-uppercase text-danger fw-bold mb-3">{fromCompany.name}</h5>

                            <div className="mb-2">
                                <strong>Address:</strong><br/>
                                {fromCompany.address_line_1}<br/>
                                {fromCompany.address_line_2}
                            </div>

                            <div className="mb-2">
                                <strong>PAN:</strong> {fromCompany.pan_number}
                            </div>
                            <div className="mb-3">
                                <strong>GST:</strong> {fromCompany.gst_number}
                            </div>

                            <div>
                                <strong>Bank Details:</strong><br/>
                                <span className="d-block"><strong>Bank Name:</strong> {fromCompany.bank_name}</span>
                                <span
                                    className="d-block"><strong>Account Number:</strong> {fromCompany.bank_account_number}</span>
                                <span className="d-block"><strong>IFSC Code:</strong> {fromCompany.ifsc_code}</span>
                                <span
                                    className="d-block"><strong>Account Type:</strong> {fromCompany.account_type?.charAt(0).toUpperCase() + fromCompany.account_type?.slice(1)}</span>
                            </div>
                        </div>

                        {/* Right: Company Logo */}
                        {fromCompany.logo && (
                            <div className="text-end">
                                <img src={fromCompany.logo} alt="Company Logo"
                                     style={{Width: '120px', Height: '80px', objectFit: 'contain'}}/>
                            </div>
                        )}
                    </div>
                )}
            </Form.Group>

            <Row className="mb-3">
                <Col md={4}>
                    <ValidatedInput
                        label="To Company"
                        value={toCompany.name}
                        onChange={e => setToCompany(prev => ({...prev, name: e.target.value}))}
                        placeholder="Enter Company Name"
                        error={errors.to_company_name} // ✅ Simplified
                    />
                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="PAN"
                        value={toCompany.pan}
                        onChange={e => setToCompany(prev => ({...prev, pan: e.target.value}))}
                        placeholder="Enter PAN Number"
                        error={errors.to_company_pan}
                    />

                </Col>
                <Col md={4}>
                    <ValidatedInput
                        label="GST"
                        value={toCompany.gst_number}
                        onChange={e => setToCompany(prev => ({...prev, gst_number: e.target.value}))}
                        placeholder="Enter GST Number"
                        error={errors.to_company_gst}
                    />

                </Col>
            </Row>
            {/* Billing Mode */}
            <Form.Group className="mb-3">
                <Form.Label>Billing Mode</Form.Label><br/>
                <Form.Check inline type="radio" label="By KG" checked={billingMode === 'kg'}
                            onChange={() => handleBillingModeChange('kg')}/>
                <Form.Check inline type="radio" label="By CIF INR (%)" checked={billingMode === 'cif_inr'}
                            onChange={() => handleBillingModeChange('cif_inr')}/>
            </Form.Group>


            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>#</th>
                    <th>License</th>
                    <th>HSN</th>
                    {billingMode === 'kg' ? (
                        <>
                            <th>Qty</th>
                        </>
                    ) : (
                        <>
                            <th>CIF $</th>
                            <th>Exc Rate</th>
                            <th>CIF INR</th>
                        </>
                    )}
                    <th>{billingMode === 'kg' ? 'Rate ₹/kg' : 'Billing %'}</th>
                    <th>Amount ₹</th>
                    <th></th>
                </tr>
                </thead>
                <tbody>
                {items.map((it, idx) => (
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
                                onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                            />
                        </td>
                        <td>{Number(it.amount).toFixed(2)}</td>
                        <td>
                            <Button size="sm" variant="danger" onClick={() => removeItem(idx)}>✖</Button>
                        </td>
                    </tr>
                ))}
                </tbody>
                <tfoot>
                <tr>
                    <td colSpan={3}>
                        <strong>Total</strong></td>
                    {billingMode === 'kg' ? (
                        <>
                            <td>{totals.qty}</td>
                            <td>-</td>
                            <td>{totals.amount}</td>
                        </>
                    ) : (
                        <>
                            <td>{totals.cif_fc}</td>
                            <td></td>
                            <td>{totals.cif_inr}</td>
                            <td></td>
                            <td>{totals.amount}</td>
                        </>
                    )}
                    <td></td>
                </tr>
                </tfoot>
            </Table>
            <Button size="sm" onClick={() => setItems([...items, {...items[0], rate: 0, amount: 0}])}>
                Add Row
            </Button>

            <hr/>
            <Button onClick={handleSave}>Save Invoice</Button>
            {invoice && <Button className="ms-2" onClick={handleGenerate}>Download Invoice</Button>}

        </Form>
    );
};

export default InvoiceForm;
