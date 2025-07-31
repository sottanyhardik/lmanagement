import React, {useEffect, useState} from 'react';
import {Button, Col, Form, Row, Spinner} from 'react-bootstrap';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';

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

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await axios.get('/api/transfer-letters/');
                const data = res.data?.results || res.data;
                if (Array.isArray(data)) {
                    setTemplates(data);
                } else {
                    console.error("Transfer letter API did not return an array:", data);
                    setTemplates([]);
                }
            } catch (err) {
                console.error('Failed to load templates:', err);
                toast.error('Failed to load TL templates');
                setTemplates([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    useEffect(() => {
        console.log('BOE:', boe);
        if (boe) {
            setFormData({
                company: boe.company?.name || '',
                company_address_line1: boe.company?.address_line_1 || '',
                company_address_line2: boe.company?.address_line_2 || '',
                tl_choice: ''
            });
        }
    }, [boe]);

    const handleChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const handleGenerate = async () => {
        if (!formData.tl_choice) {
            toast.warning('Please select a TL template');
            return;
        }
        setGenerating(true);
        try {
            const payload = {...formData};
            const res = await axios.post(`/boe/${boe.id}/generate/${boe.id}/`, payload);
            toast.success('Transfer Letter Generated');

            if (autoDownload && res.data?.url) {
                const link = document.createElement('a');
                link.href = res.data.url;
                link.download = '';
                link.target = '_blank';
                link.click();
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate TL');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return <div className="text-muted"><Spinner size="sm"/> Loading templates...</div>;
    }

    return (
        <Form className="border p-3 rounded bg-light">
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Label>Company</Form.Label>
                    <Form.Control
                        value={formData.company ?? ""}
                        onChange={e => handleChange('company', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 1</Form.Label>
                    <Form.Control
                        value={formData.company_address_line1 ?? ""}
                        onChange={e => handleChange('company_address_line1', e.target.value)}
                    />
                </Col>
                <Col md={4}>
                    <Form.Label>Address Line 2</Form.Label>
                    <Form.Control
                        value={formData.company_address_line2 ?? ""}
                        onChange={e => handleChange('company_address_line2', e.target.value)}
                    />
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Label>Select Template</Form.Label>
                    <Form.Select
                        value={formData.tl_choice ?? ""}
                        onChange={(e) => handleChange('tl_choice', e.target.value)}
                    >
                        <option value="">-- Select Transfer Letter Template --</option>
                        {Array.isArray(templates) && templates.map(template => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </Form.Select>
                </Col>
                <Col md={6} className="d-flex align-items-end">
                    <Button variant="primary" onClick={handleGenerate} disabled={generating}>
                        {generating ? 'Generating...' : 'Generate Transfer Letter'}
                    </Button>
                </Col>
            </Row>
        </Form>
    );
};

export default TransferLetterForm;
