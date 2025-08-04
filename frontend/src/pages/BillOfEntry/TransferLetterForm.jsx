import React, {useEffect, useState} from 'react';
import {Button, Col, Form, Row, Spinner, Table} from 'react-bootstrap';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import {fetchTransferLetterTemplates} from '../../Cache/templateCache';

const TransferLetterForm = ({boe, autoDownload = false}) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [formData, setFormData] = useState({
        company: '',
        company_address_line1: '',
        company_address_line2: '',
        tl_choice: ''
    });

    const [editableItems, setEditableItems] = useState([]);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const data = await fetchTransferLetterTemplates();
                setTemplates(Array.isArray(data) ? data : []);
            } catch (err) {
                toast.error('Failed to load TL templates');
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, []);

    useEffect(() => {
        if (boe && boe.company) {
            setFormData({
                company: boe.company.name || '',
                company_address_line1: boe.company.address_line_1 || '',
                company_address_line2: boe.company.address_line_2 || '',
                tl_choice: ''
            });

            setEditableItems(
                boe.item_details?.map((item, index) => ({
                    id: item.id || index,
                    sr_number: item.sr_number?.display_name || `SR ${index + 1}`,
                    cif_fc: item.cif_fc
                })) || []
            );
        }
    }, [boe]);

    const handleChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const handleCifChange = (index, value) => {
        setEditableItems(prev =>
            prev.map((item, idx) =>
                idx === index ? {...item, cif_fc: value} : item
            )
        );
    };

    const handleGenerate = async () => {
        if (!formData.tl_choice) {
            toast.warning('Please select a TL template');
            return;
        }

        setGenerating(true);
        try {
            const payload = {
                ...formData,
                modified_items: editableItems
            };

            const res = await axios.post(`/boe/${boe.id}/generate`, payload);
            toast.success('Transfer Letter Generated');

            if (autoDownload && res.data?.url) {
                const link = document.createElement('a');
                link.href = res.data.url;
                link.download = '';
                link.target = '_blank';
                link.click();
            }
        } catch (err) {
            console.error('Failed to generate TL:', err);
            toast.error('Failed to generate TL');
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
                        onChange={e => handleChange('company', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 1</Form.Label>
                    <Form.Control
                        value={formData.company_address_line1}
                        onChange={e => handleChange('company_address_line1', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 2</Form.Label>
                    <Form.Control
                        value={formData.company_address_line2}
                        onChange={e => handleChange('company_address_line2', e.target.value)}
                    />
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>Select Template</Form.Label>
                    <Form.Select
                        value={formData.tl_choice}
                        onChange={e => handleChange('tl_choice', e.target.value)}
                    >
                        <option value="">-- Select Transfer Letter Template --</option>
                        {templates.map(template => (
                            <option key={template.id} value={template.id}>
                                {template.name}
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
                                onChange={e => handleCifChange(idx, e.target.value)}
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

export default TransferLetterForm;
