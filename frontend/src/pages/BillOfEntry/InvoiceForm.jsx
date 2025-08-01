import React, {useEffect, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import AsyncEntitySelect from './AsyncEntitySelect';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';

const InvoiceForm = ({boe}) => {
    const [loading, setLoading] = useState(true);
    const [entity, setEntity] = useState(null);
    const [fromCompany, setFromCompany] = useState({});
    const [toCompany, setToCompany] = useState({});
    const [billingMode, setBillingMode] = useState('kg');
    const [items, setItems] = useState([]);
    const [invoiceRecord, setInvoiceRecord] = useState(null);

    useEffect(() => {
        if (boe) {
            setToCompany({
                id: boe.company.id,
                name: boe.company.name || '',
                address_line_1: boe.company.address_line_1 || '',
                address_line_2: boe.company.address_line_2 || '',
                pan: boe.company.pan || '',
                gst: boe.company.gst_number || ''
            });
            setItems(boe.item_details.map(detail => ({
                sr_id: detail.sr_number.id,
                license_no: detail.sr_number.display_name.split('-')[0].trim().replace(/^0+/, ''),
                hsn_code: '490700',
                qty: Number(detail.qty),
                cif_fc: Number(detail.cif_fc),
                exchange_rate: Number(boe.exchange_rate),
                cif_inr: Number(detail.cif_inr),
                rate: '',
                amount: 0
            })));
        }
        setLoading(false);
    }, [boe]);

    useEffect(() => {
        const fetchEntityDetails = async () => {
            if (!entity?.id) return;
            try {
                const res = await axios.get(`/api/invoice-entities/${entity.id}/`);
                setFromCompany(res.data);
            } catch (error) {
                console.error('Failed to fetch entity details:', error);
            }
        };
        fetchEntityDetails();
    }, [entity]);

    const handleItemChange = (idx, field, value) => {
        const updated = [...items];
        updated[idx][field] = Number(value);
        const rate = parseFloat(updated[idx].rate || 0);
        updated[idx].amount = billingMode === 'kg'
            ? updated[idx].qty * rate
            : (updated[idx].cif_inr * rate) / 100;
        setItems(updated);
    };

    const handleBillingModeChange = mode => {
        setBillingMode(mode);
        setItems(prev => prev.map(it => {
            const rate = parseFloat(it.rate || 0);
            const amount = mode === 'kg' ? it.qty * rate : (it.cif_inr * rate) / 100;
            return {...it, amount};
        }));
    };

    const addItem = () => setItems(prev => [...prev, {
        license_no: '', hsn_code: '490700', qty: 0, cif_fc: 0, exchange_rate: 0, cif_inr: 0, rate: 0, amount: 0
    }]);

    const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx));

    const totals = items.reduce((acc, it) => ({
        qty: acc.qty + it.qty,
        cif_fc: acc.cif_fc + it.cif_fc,
        cif_inr: acc.cif_inr + it.cif_inr,
        amount: acc.amount + it.amount
    }), {qty: 0, cif_fc: 0, cif_inr: 0, amount: 0});

    const handleSave = async () => {
        try {
            const payload = {
                bills_of_entry_id: boe?.id || null,
                from_entity_id: fromCompany.id,
                to_company_id: boe.company.id,
                to_company: {
                    id: boe.company.id,
                    name: toCompany.name,
                    address_line_1: toCompany.address_line_1,
                    address_line_2: toCompany.address_line_2,
                    pan: toCompany.pan,
                    gst: toCompany.gst
                },
                billing_mode: billingMode,
                items: items.map(it => ({
                    sr_number: it.sr_id,
                    license_no: it.license_no?.split('-')[0]?.trim(),
                    hsn_code: it.hsn_code,
                    qty: it.qty || null,
                    cif_fc: it.cif_fc || null,
                    cif_inr: it.cif_inr || null,
                    rate: it.rate,
                    amount: it.amount
                }))
            };
            console.log(payload);
            const res = await axios.post('/api/invoices/', payload);
            setInvoiceRecord(res.data);
            toast.success('Invoice saved');
        } catch (err) {
            console.error(err.response?.data || err);
            toast.error('Save failed');
        }
    };

    const handleGenerate = () => {
        const invoiceId = invoiceRecord?.id;
        if (!invoiceId) {
            toast.error('Save the invoice first to generate PDF');
            return;
        }
        const link = document.createElement('a');
        link.href = `/api/invoices/${invoiceId}/pdf/`;
        link.target = '_blank';
        link.download = invoiceRecord.invoice_number ? `${invoiceRecord.invoice_number}.pdf` : 'invoice.pdf';
        link.click();
    };

    if (loading) return <Spinner animation="border" size="sm"/>;

    return (
        <Form className="p-3 bg-light rounded">
            {/* From Company */}
            <Form.Group className="mb-3">
                <Form.Label>From Company</Form.Label>
                <AsyncEntitySelect value={entity} onChange={setEntity}/>
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

            {/* To Company */}
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>To Company Name</Form.Label>
                    <Form.Control value={toCompany.name} readOnly/>
                </Col>
                <Col md={4}>
                    <Form.Label>To PAN</Form.Label>
                    <Form.Control value={toCompany.pan}
                                  onChange={e => setToCompany(prev => ({...prev, pan: e.target.value}))}/>
                </Col>
                <Col md={4}>
                    <Form.Label>To GST</Form.Label>
                    <Form.Control value={toCompany.gst}
                                  onChange={e => setToCompany(prev => ({...prev, gst: e.target.value}))}/>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>To Address Line 1</Form.Label>
                    <Form.Control value={toCompany.address_line_1} readOnly/>
                </Col>
                <Col md={6}>
                    <Form.Label>To Address Line 2</Form.Label>
                    <Form.Control value={toCompany.address_line_2} readOnly/>
                </Col>
            </Row>

            {/* Billing Mode */}
            <Form.Group className="mb-3">
                <Form.Label>Billing Mode</Form.Label><br/>
                <Form.Check inline type="radio" label="By KG" checked={billingMode === 'kg'}
                            onChange={() => handleBillingModeChange('kg')}/>
                <Form.Check inline type="radio" label="By CIF INR (%)" checked={billingMode === 'cif'}
                            onChange={() => handleBillingModeChange('cif')}/>
            </Form.Group>

            {/* Items Table */}
            <Table bordered size="sm">
                <thead>
                <tr>
                    <th>#</th>
                    <th>License</th>
                    <th>HSN</th>
                    {billingMode === 'kg' ? <th>Qty</th> : <>
                        <th>CIF $</th>
                        <th>Exc Rate</th>
                        <th>CIF INR</th>
                    </>}
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
                        {billingMode === 'kg'
                            ? <td>{it.qty}</td>
                            : <>
                                <td>{it.cif_fc}</td>
                                <td>{it.exchange_rate}</td>
                                <td>{it.cif_inr}</td>
                            </>
                        }
                        <td>
                            <Form.Control type="number" size="sm" value={it.rate}
                                          onChange={e => handleItemChange(idx, 'rate', e.target.value)}/>
                        </td>
                        <td>{it.amount.toFixed(2)}</td>
                        <td><Button size="sm" variant="danger" onClick={() => removeItem(idx)}>✖</Button></td>
                    </tr>
                ))}
                </tbody>
            </Table>

            <Button size="sm" variant="secondary" onClick={addItem}>Add Row</Button>

            {/* Summary */}
            <div className="mt-3">
                <strong>Total Qty:</strong> {totals.qty} |
                <strong> Total CIF $:</strong> {totals.cif_fc.toFixed(2)} |
                <strong> Total CIF INR:</strong> ₹{totals.cif_inr.toFixed(2)} |
                <strong> Total Invoice Amount:</strong> ₹{totals.amount.toFixed(2)}
            </div>

            {/* Action Buttons */}
            {!invoiceRecord && <Button className="mt-3" onClick={handleSave}>Save Invoice</Button>}
            <Button className="mt-3 ms-2" onClick={handleGenerate}>
                {invoiceRecord ? 'Download Invoice' : 'Generate Invoice'}
            </Button>
        </Form>
    );
};

export default InvoiceForm;
