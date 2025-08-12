// src/pages/Allotment/TransferLetterFromAllotment.jsx
import React, {useEffect, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import {fetchTransferLetterTemplates} from '../../Cache/templateCache';

/**
 * Props:
 *  - allotment: object (expects .company, .allotment_details)
 *  - autoDownload?: boolean = false
 *  - generatePath?: string (override API path). Default: `/api/allotments/{id}/generate-tl/`
 */
const TransferLetterFromAllotment = ({allotment, autoDownload = false, generatePath}) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [formData, setFormData] = useState({
        company: '',
        company_address_line1: '',
        company_address_line2: '',
        tl_choice: '',
    });

    const [editableItems, setEditableItems] = useState([]);

    // Load TL templates (cached helper)
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchTransferLetterTemplates();
                setTemplates(Array.isArray(data) ? data : []);
            } catch {
                toast.error('Failed to load TL templates');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Seed form and items from Allotment
    useEffect(() => {
        if (!allotment) return;

        const company = allotment.company || {};
        setFormData({
            company: company.name || '',
            company_address_line1: company.address_line_1 || '',
            company_address_line2: company.address_line_2 || '',
            tl_choice: '',
        });

        const items = (allotment.allotment_details || []).map((d, idx) => ({
            id: d.id ?? idx,
            // prefer nested item.display_name; fall back to sr_number?.label; else generic
            sr_number:
                d.item?.display_name ||
                d.sr_number?.label ||
                (d.item?.serial_number ? `SR ${d.item.serial_number}` : `SR ${idx + 1}`),
            cif_fc: d.cif_fc ?? '',
        }));

        setEditableItems(items);
    }, [allotment]);

    const handleChange = (field, value) =>
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));

    const handleCifChange = (index, value) => {
        setEditableItems((prev) =>
            prev.map((it, i) => (i === index ? {...it, cif_fc: value} : it))
        );
    };

    const handleGenerate = async () => {
        if (!formData.tl_choice) {
            toast.warning('Please select a TL template');
            return;
        }
        if (!allotment?.id) {
            toast.error('Missing allotment ID');
            return;
        }

        setGenerating(true);
        try {
            const payload = {
                ...formData,
                modified_items: editableItems, // [{ id, sr_number, cif_fc }]
            };

            const url =
                generatePath ||
                `/api/allotments/${encodeURIComponent(allotment.id)}/generate-tl/`;

            const res = await axios.post(url, payload);
            toast.success('Transfer Letter Generated');

            const dlUrl = res?.data?.url;
            if (autoDownload && dlUrl) {
                const link = document.createElement('a');
                link.href = dlUrl;
                link.download = '';
                link.target = '_blank';
                link.click();
            }
        } catch (err) {
            // Try to surface API message if any
            const apiMsg =
                err?.response?.data?.detail ||
                err?.response?.data?.error ||
                err?.message;
            toast.error(apiMsg ? `Failed to generate TL: ${apiMsg}` : 'Failed to generate TL');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="text-muted">
                <Spinner size="sm"/> Loading templates...
            </div>
        );
    }

    return (
        <Form className="border p-3 rounded bg-light">
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Company</Form.Label>
                    <Form.Control
                        value={formData.company}
                        onChange={(e) => handleChange('company', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 1</Form.Label>
                    <Form.Control
                        value={formData.company_address_line1}
                        onChange={(e) => handleChange('company_address_line1', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 2</Form.Label>
                    <Form.Control
                        value={formData.company_address_line2}
                        onChange={(e) => handleChange('company_address_line2', e.target.value)}
                    />
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>Select Template</Form.Label>
                    <Form.Select
                        value={formData.tl_choice}
                        onChange={(e) => handleChange('tl_choice', e.target.value)}
                    >
                        <option value="">-- Select Transfer Letter Template --</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </Form.Select>
                </Col>
            </Row>

            <h6 className="mt-3 mb-2">Edit CIF FC Values</h6>
            <Table bordered size="sm" className="mb-3">
                <thead className="table-light">
                <tr>
                    <th>#</th>
                    <th>SR Number</th>
                    <th className="text-end">CIF FC (editable)</th>
                </tr>
                </thead>
                <tbody>
                {editableItems.map((item, idx) => (
                    <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td>{item.sr_number}</td>
                        <td className="text-end">
                            <Form.Control
                                type="number"
                                min="0"
                                value={item.cif_fc}
                                onChange={(e) => handleCifChange(idx, e.target.value)}
                                style={{textAlign: 'right'}}
                            />
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>

            <div className="text-end">
                <Button variant="primary" onClick={handleGenerate} disabled={generating}>
                    {generating ? 'Generating...' : 'Generate Transfer Letter'}
                </Button>
            </div>
        </Form>
    );
};

export default TransferLetterFromAllotment;
