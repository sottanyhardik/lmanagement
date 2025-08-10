// src/pages/Allotment/AllotmentEditMain.jsx
import React, {useEffect, useState} from 'react';
import {Button, Card, Col, Container, Form, Row} from 'react-bootstrap';
import {useNavigate, useParams} from 'react-router-dom';
import axios from '../../api/axiosInstance';
import AsyncCompanySelect from '../../components/AsyncCompanySelect';
import AsyncPortSelect from '../../components/AsyncPortSelect';
import {toast} from 'react-toastify';

const AllotmentEditMain = () => {
    const {id} = useParams();
    const nav = useNavigate();
    const [data, setData] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const {data} = await axios.get(`/api/allotments/${id}/`);
                if (mounted) setData(data);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => (mounted = false);
    }, [id]);

    const set = (k, v) => setData((p) => ({...p, [k]: v}));

    const save = async () => {
        setSaving(true);
        try {
            await axios.patch(`/api/allotments/${id}/`, {
                company_id: data.company?.id,
                port_id: data.port?.id || null,
                related_company_id: data.related_company?.id || null,
                required_quantity: Number(data.required_quantity) || 0,
                unit_value_per_unit: Number(data.unit_value_per_unit) || 0,
                item_name: data.item_name,
                contact_person: data.contact_person || null,
                contact_number: data.contact_number || null,
                invoice: data.invoice || null,
                estimated_arrival_date: data.estimated_arrival_date || null,
                bl_detail: data.bl_detail || null,
            });
            toast.success('Allotment updated');
            nav(`/allotments/${id}/view`);
        } catch (e) {
            console.error(e);
            toast.error('Failed to update');
        } finally {
            setSaving(false);
        }
    };

    if (!data) return <Container className="py-4">
        <div className="spinner-border"/>
    </Container>;

    return (
        <Container className="py-4">
            <Card className="shadow-sm">
                <Card.Header className="bg-white fw-bold">Edit Allotment (Main)</Card.Header>
                <Card.Body>
                    <Row className="mb-3">
                        <Col md={4}>
                            <Form.Label>Company</Form.Label>
                            <AsyncCompanySelect value={data.company ?? ''} onChange={(v) => set('company', v)}/>
                        </Col>
                        <Col md={4}>
                            <Form.Label>Port</Form.Label>
                            <AsyncPortSelect value={data.port ?? ''} onChange={(v) => set('port', v)}/>
                        </Col>
                        <Col md={4}>
                            <Form.Label>Related Company</Form.Label>
                            <AsyncCompanySelect value={data.related_company ?? ''}
                                                onChange={(v) => set('related_company', v)}/>
                        </Col>
                    </Row>

                    <Row className="mb-3">
                        <Col md={4}>
                            <Form.Label>Item Name</Form.Label>
                            <Form.Control size="sm" value={data.item_name || ''}
                                          onChange={(e) => set('item_name', e.target.value)}/>
                        </Col>
                        <Col md={4}>
                            <Form.Label>Required Quantity</Form.Label>
                            <Form.Control size="sm" type="number" step="0.01" value={data.required_quantity ?? ''}
                                          onChange={(e) => set('required_quantity', e.target.value)}/>
                        </Col>
                        <Col md={4}>
                            <Form.Label>Unit Value / Unit</Form.Label>
                            <Form.Control size="sm" type="number" step="0.01" value={data.unit_value_per_unit ?? ''}
                                          onChange={(e) => set('unit_value_per_unit', e.target.value)}/>
                        </Col>
                    </Row>

                    <Row className="mb-3">
                        <Col md={4}>
                            <Form.Label>Invoice</Form.Label>
                            <Form.Control size="sm" value={data.invoice || ''}
                                          onChange={(e) => set('invoice', e.target.value)}/>
                        </Col>
                        <Col md={4}>
                            <Form.Label>Estimated Arrival</Form.Label>
                            <Form.Control size="sm" type="date" value={data.estimated_arrival_date || ''}
                                          onChange={(e) => set('estimated_arrival_date', e.target.value)}/>
                        </Col>
                        <Col md={4}>
                            <Form.Label>BL Detail</Form.Label>
                            <Form.Control size="sm" value={data.bl_detail || ''}
                                          onChange={(e) => set('bl_detail', e.target.value)}/>
                        </Col>
                    </Row>

                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Label>Contact Person</Form.Label>
                            <Form.Control size="sm" value={data.contact_person || ''}
                                          onChange={(e) => set('contact_person', e.target.value)}/>
                        </Col>
                        <Col md={6}>
                            <Form.Label>Contact Number</Form.Label>
                            <Form.Control size="sm" value={data.contact_number || ''}
                                          onChange={(e) => set('contact_number', e.target.value)}/>
                        </Col>
                    </Row>

                    <div className="d-flex justify-content-end">
                        <Button variant="secondary" size="sm" className="me-2" onClick={() => nav(-1)}>Cancel</Button>
                        <Button variant="success" size="sm" onClick={save}
                                disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    </div>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default AllotmentEditMain;
