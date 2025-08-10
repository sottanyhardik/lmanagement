// src/pages/Allotment/AllotmentView.jsx
import React, {useEffect, useState} from 'react';
import {Badge, Card, Col, Container, Row, Table} from 'react-bootstrap';
import {useParams} from 'react-router-dom';
import axios from '../../api/axiosInstance';

const fmt = (n) =>
    n === null || n === undefined || Number.isNaN(Number(n))
        ? '-'
        : Number(n).toLocaleString('en-IN', {maximumFractionDigits: 2});

const Field = ({label, value}) => (
    <Col md={3} className="mb-2"><strong>{label}:</strong> {value ?? '-'}</Col>
);

const AllotmentView = () => {
    const {id} = useParams();
    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const {data} = await axios.get(`/api/allotments/${id}/`);
                if (mounted) setEntry(data);
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => (mounted = false);
    }, [id]);

    if (loading) return <Container className="py-4">
        <div className="spinner-border"/>
    </Container>;
    if (!entry) return <Container className="py-4">Not found</Container>;

    return (
        <Container className="py-4">
            <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                    <div>
                        <div className="fw-bold">{entry.item_name}</div>
                        <div className="text-muted small">{entry.company?.name}</div>
                    </div>
                    <div className="text-end">
                        <Badge bg={Number(entry.balanced_quantity) > 0 ? 'warning' : 'success'} className="me-2">
                            Balance: {fmt(entry.balanced_quantity)}
                        </Badge>
                        <Badge bg="info" className="me-2">
                            Allotted Qty: {fmt(entry.alloted_quantity)}
                        </Badge>
                        <Badge bg="secondary">Allotted $: {fmt(entry.allotted_value)}</Badge>
                    </div>
                </Card.Header>
                <Card.Body>
                    <Row className="mb-2">
                        <Field label="Required Qty" value={fmt(entry.required_quantity)}/>
                        <Field label="Unit Value / Unit" value={fmt(entry.unit_value_per_unit)}/>
                        <Field label="Required Value" value={fmt(entry.required_value)}/>
                        <Field label="Invoice" value={entry.invoice}/>
                        <Field label="ETA" value={entry.estimated_arrival_date || '-'}/>
                        <Field label="BL Detail" value={entry.bl_detail || '-'}/>
                        <Field label="Port" value={entry.port ? `${entry.port.name} (${entry.port.code})` : '-'}/>
                        <Field label="Related Company" value={entry.related_company?.name || '-'}/>
                    </Row>

                    <Row className="mb-3">
                        <Field label="Contact Person" value={entry.contact_person || '-'}/>
                        <Field label="Contact Number" value={entry.contact_number || '-'}/>
                        <Col md={6} className="mb-2"><strong>DFIA:</strong> {entry.dfia_list || '-'}</Col>
                    </Row>

                    <h6 className="mt-2">Lines</h6>
                    <Table bordered size="sm" responsive>
                        <thead className="table-light">
                        <tr>
                            <th>#</th>
                            <th>SR</th>
                            <th>Description</th>
                            <th>HS</th>
                            <th>Unit</th>
                            <th className="text-end">Qty</th>
                            <th className="text-end">CIF $</th>
                            <th className="text-end">CIF ₹</th>
                            <th>License</th>
                            <th>Exporter</th>
                            <th>Port</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(entry.allotment_details || []).map((d, i) => (
                            <tr key={d.id || i}>
                                <td>{i + 1}</td>
                                <td>{d.serial_number}</td>
                                <td>{d.description}</td>
                                <td>{d.hs_code}</td>
                                <td>{d.unit}</td>
                                <td className="text-end">{fmt(d.qty)}</td>
                                <td className="text-end">{fmt(d.cif_fc)}</td>
                                <td className="text-end">{fmt(d.cif_inr)}</td>
                                <td>{d.license_number} | {d.license_date}</td>
                                <td>{d.exporter_name}</td>
                                <td>{d.port_name} ({d.port_code})</td>
                            </tr>
                        ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default AllotmentView;
