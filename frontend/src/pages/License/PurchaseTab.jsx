import React, {useMemo, useState} from 'react';
import {Badge, Button, Col, Form, InputGroup, Row, Table} from 'react-bootstrap';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';

const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const formatIN = (n) =>
    Number.isFinite(n) ? n.toLocaleString('en-IN', {maximumFractionDigits: 2}) : '-';

const TotalChip = ({label, value, onClick}) => (
    <Badge
        bg="light"
        text="dark"
        role="button"
        className="border me-2 mb-2"
        onClick={() => onClick?.(value)}
        title={`Click to use ${label}`}
    >
        {label}: <span className="fw-semibold ms-1">{formatIN(value)}</span>
    </Badge>
);

/**
 * Props:
 * - entry: license object (must include export_license array if available)
 * - onSaved: (id) => void   // to refresh parent entry after successful save
 */
export default function PurchaseTab({entry, onSaved}) {
    const [purchaseType, setPurchaseType] = useState('full'); // 'full' | 'partial'
    const [purchaseAmount, setPurchaseAmount] = useState('');
    const [cifFc, setCifFc] = useState('');
    const [fobInr, setFobInr] = useState('');
    const [cifInr, setCifInr] = useState('');

    const [licenseCopy, setLicenseCopy] = useState(null);
    const [transferLetter, setTransferLetter] = useState(null);

    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Totals from export rows (fallback-safe)
    const totals = useMemo(() => {
        const exp = Array.isArray(entry?.export_license) ? entry.export_license : [];
        const sum = (k) => exp.reduce((s, x) => s + (parseFloat(x?.[k]) || 0), 0);
        return {
            cif_fc: sum('cif_fc'),     // CIF $
            cif_inr: sum('cif_inr'),   // CIF INR
            fob_inr: sum('fob_inr'),   // FOB INR
        };
    }, [entry?.export_license]);

    const handlePasteTotal = (field, val) => {
        const v = (val ?? 0).toFixed(2);
        if (field === 'purchaseAmount') setPurchaseAmount(v);
        if (field === 'cif_fc') setCifFc(v);
        if (field === 'fob_inr') setFobInr(v);
        if (field === 'cif_inr') setCifInr(v);
    };

    const handleSavePurchase = async () => {
        if (!purchaseAmount && purchaseType === 'full') {
            toast.error('Please enter a Purchase Amount.');
            return;
        }
        setSaving(true);
        try {
            const payload =
                purchaseType === 'full'
                    ? {
                        purchase_type: 'full',
                        purchase_amount: toNum(purchaseAmount),
                    }
                    : {
                        purchase_type: 'partial',
                        purchase_amount: toNum(purchaseAmount) || undefined,
                        cif_fc: cifFc !== '' ? toNum(cifFc) : undefined,
                        fob_inr: fobInr !== '' ? toNum(fobInr) : undefined,
                        cif_inr: cifInr !== '' ? toNum(cifInr) : undefined,
                    };

            await axios.post(`licenses/${entry.id}/purchase/`, payload);
            toast.success('Purchase saved');
            onSaved?.(entry.id);
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.error ||
                'Failed to save purchase';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleUploadDocs = async () => {
        if (!licenseCopy && !transferLetter) {
            toast.warn('Please select a License Copy and/or Transfer Letter.');
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            if (licenseCopy) fd.append('license_copy', licenseCopy);
            if (transferLetter) fd.append('transfer_letter', transferLetter);

            await axios.post(`licenses/${entry.id}/documents/`, fd, {
                headers: {'Content-Type': 'multipart/form-data'},
            });
            toast.success('Documents uploaded');
            setLicenseCopy(null);
            setTransferLetter(null);
            onSaved?.(entry.id);
        } catch (err) {
            console.error(err);
            toast.error('Failed to upload documents');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <Row className="g-3">
                <Col md={7}>
                    <h6 className="mb-2">Purchase</h6>

                    <div className="mb-2">
                        <TotalChip label="Total CIF $" value={totals.cif_fc}
                                   onClick={(v) => handlePasteTotal('cif_fc', v)}/>
                        <TotalChip label="Total CIF INR" value={totals.cif_inr}
                                   onClick={(v) => handlePasteTotal('cif_inr', v)}/>
                        <TotalChip label="Total FOB INR" value={totals.fob_inr}
                                   onClick={(v) => handlePasteTotal('fob_inr', v)}/>
                    </div>

                    <Form>
                        <Row className="g-2 align-items-end">
                            <Col sm={6} md={5}>
                                <Form.Label className="mb-1">Purchase Amount</Form.Label>
                                <InputGroup size="sm">
                                    <InputGroup.Text>₹/$</InputGroup.Text>
                                    <Form.Control
                                        inputMode="decimal"
                                        value={purchaseAmount}
                                        onChange={(e) => setPurchaseAmount(e.target.value)}
                                        placeholder="Amount"
                                    />
                                </InputGroup>
                            </Col>

                            <Col sm={6} md={7}>
                                <Form.Label className="mb-1">Type</Form.Label>
                                <div className="d-flex gap-3">
                                    <Form.Check
                                        type="radio"
                                        id={`purchase-full-${entry.id}`}
                                        label="Full"
                                        checked={purchaseType === 'full'}
                                        onChange={() => setPurchaseType('full')}
                                    />
                                    <Form.Check
                                        type="radio"
                                        id={`purchase-partial-${entry.id}`}
                                        label="Partial"
                                        checked={purchaseType === 'partial'}
                                        onChange={() => setPurchaseType('partial')}
                                    />
                                </div>
                            </Col>
                        </Row>

                        {purchaseType === 'partial' && (
                            <Row className="g-2 mt-2">
                                <Col md={4}>
                                    <Form.Label className="mb-1">CIF $ (optional)</Form.Label>
                                    <InputGroup size="sm">
                                        <InputGroup.Text>$</InputGroup.Text>
                                        <Form.Control
                                            inputMode="decimal"
                                            value={cifFc}
                                            onChange={(e) => setCifFc(e.target.value)}
                                            placeholder="e.g. 1200.50"
                                        />
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => handlePasteTotal('cif_fc', totals.cif_fc)}
                                        >
                                            Use Total
                                        </Button>
                                    </InputGroup>
                                </Col>

                                <Col md={4}>
                                    <Form.Label className="mb-1">FOB INR (optional)</Form.Label>
                                    <InputGroup size="sm">
                                        <InputGroup.Text>₹</InputGroup.Text>
                                        <Form.Control
                                            inputMode="decimal"
                                            value={fobInr}
                                            onChange={(e) => setFobInr(e.target.value)}
                                            placeholder="e.g. 250000"
                                        />
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => handlePasteTotal('fob_inr', totals.fob_inr)}
                                        >
                                            Use Total
                                        </Button>
                                    </InputGroup>
                                </Col>

                                <Col md={4}>
                                    <Form.Label className="mb-1">CIF INR (optional)</Form.Label>
                                    <InputGroup size="sm">
                                        <InputGroup.Text>₹</InputGroup.Text>
                                        <Form.Control
                                            inputMode="decimal"
                                            value={cifInr}
                                            onChange={(e) => setCifInr(e.target.value)}
                                            placeholder="e.g. 175000"
                                        />
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => handlePasteTotal('cif_inr', totals.cif_inr)}
                                        >
                                            Use Total
                                        </Button>
                                    </InputGroup>
                                </Col>
                            </Row>
                        )}

                        <div className="mt-3 d-flex gap-2">
                            <Button size="sm" onClick={handleSavePurchase} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Purchase'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => {
                                    setPurchaseType('full');
                                    setPurchaseAmount('');
                                    setCifFc('');
                                    setFobInr('');
                                    setCifInr('');
                                }}
                                disabled={saving}
                            >
                                Reset
                            </Button>
                        </div>
                    </Form>
                </Col>

                <Col md={5}>
                    <h6 className="mb-2">Documents</h6>
                    <Table bordered size="sm" className="align-middle">
                        <tbody>
                        <tr>
                            <td style={{width: 180}}>License Copy (PDF/IMG)</td>
                            <td>
                                <Form.Control
                                    type="file"
                                    size="sm"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => setLicenseCopy(e.target.files?.[0] || null)}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>Transfer Letter (PDF/IMG)</td>
                            <td>
                                <Form.Control
                                    type="file"
                                    size="sm"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => setTransferLetter(e.target.files?.[0] || null)}
                                />
                            </td>
                        </tr>
                        </tbody>
                    </Table>
                    <div className="d-flex gap-2">
                        <Button variant="secondary" size="sm" onClick={handleUploadDocs} disabled={uploading}>
                            {uploading ? 'Uploading…' : 'Upload Documents'}
                        </Button>
                        {(licenseCopy || transferLetter) && (
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => {
                                    setLicenseCopy(null);
                                    setTransferLetter(null);
                                }}
                                disabled={uploading}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </Col>
            </Row>
        </div>
    );
}
