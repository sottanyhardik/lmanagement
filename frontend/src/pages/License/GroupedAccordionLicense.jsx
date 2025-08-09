import React, {useRef, useState} from 'react';
import {Accordion, Badge, Card, Col, Collapse, Form, Row, Tab, Table, Tabs} from 'react-bootstrap';
import LicenseForm from './LicenseForm';

const GroupedAccordionLicense = ({
                                     groups,
                                     allExpanded,
                                     expanded,
                                     toggle,
                                     selectedIds,
                                     toggleSelect,
                                     toggleSelectAll,
                                     onSaved
                                 }) => {
    const [activeTab, setActiveTab] = useState({});
    const focusedRef = useRef({});

    const handleSaved = (id, updatedEntry) => {
        if (!id) return;
        onSaved(id, updatedEntry); // pass full updated entry
        setTimeout(() => {
            setActiveTab(prev => ({...prev, [id]: 'edit'})); // open edit tab
            focusedRef.current[id]?.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 100);
    };


    const formatNumber = (val) =>
        val?.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '-';

    const calcTotals = (items = []) =>
        items.reduce((acc, i) => ({
            qty: acc.qty + (parseFloat(i.quantity) || 0),
            fc: acc.fc + (parseFloat(i.cif_fc) || 0),
            inr: acc.inr + (parseFloat(i.cif_inr) || 0),
        }), {qty: 0, fc: 0, inr: 0});

    return (
        <Accordion alwaysOpen activeKey={allExpanded ? Object.keys(groups).map((_, i) => `exporter-${i}`) : []}>
            {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([exporter, {ports}], exporterIndex) => (
                <Accordion.Item eventKey={`exporter-${exporterIndex}`} key={exporter}
                                className="border border-primary mb-3">
                    <Accordion.Header>
                        <div className="w-100">
                            <div className="fw-bold fs-5 text-primary">🏭 Exporter: {exporter}</div>
                        </div>
                    </Accordion.Header>
                    <Accordion.Body className="bg-white">
                        {Object.entries(ports).map(([port, licenses]) => {
                            const totals = calcTotals(licenses.flatMap(l => l.import_license || []));
                            return (
                                <div key={port} className="border rounded p-3 mb-4 bg-light shadow-sm">
                                    <div className="fw-semibold text-primary mb-2">
                                        🛳 Port: {port} — Qty: <Badge bg="primary">{formatNumber(totals.qty)}</Badge> |
                                        CIF $: <Badge bg="info">{formatNumber(totals.fc)}</Badge> |
                                        INR ₹<Badge bg="success">{formatNumber(totals.inr)}</Badge>
                                    </div>

                                    <Form.Check
                                        type="checkbox"
                                        className="mb-2"
                                        label={`Select All (${licenses.length})`}
                                        checked={licenses.every(entry => selectedIds.includes(entry.id))}
                                        onChange={() => toggleSelectAll(licenses.map(e => e.id))}
                                    />

                                    {licenses.map(entry => (
                                        <Card key={entry.id} className="mb-3 shadow-sm border border-secondary"
                                              ref={el => focusedRef.current[entry.id] = el}>
                                            <Card.Header
                                                className="d-flex align-items-center justify-content-between bg-white border-bottom">
                                                <Form.Check
                                                    type="checkbox"
                                                    className="me-2"
                                                    checked={selectedIds.includes(entry.id)}
                                                    onChange={() => toggleSelect(entry.id)}
                                                />
                                                <div onClick={() => toggle(entry.id)}
                                                     style={{cursor: 'pointer', flex: 1}}>
                                                    <Row className="gx-3 flex-nowrap overflow-auto small text-nowrap">
                                                        <Col className="flex-shrink-0">
                                                            <strong className="text-primary">License
                                                                #: {entry.license_number}</strong>
                                                        </Col>
                                                        <Col className="flex-shrink-0">Issue
                                                            Date: <strong>{entry.license_date}</strong></Col>
                                                        <Col
                                                            className="flex-shrink-0">Expiry:<strong> {entry.license_expiry_date}</strong></Col>
                                                        <Col className="flex-shrink-0">Norm
                                                            Class: <strong>{entry?.export_license?.[0]?.norm_class?.norm_class || ''}</strong></Col>
                                                        <Col className="flex-shrink-0">Notification
                                                            No: <strong>{entry?.notification_number || ''}</strong></Col>
                                                        <Col className="flex-shrink-0">CIF
                                                            $: <strong>{formatNumber(entry.balance_cif)}</strong></Col>
                                                    </Row>
                                                </div>
                                            </Card.Header>
                                            <Collapse in={!!expanded[entry.id]}>
                                                <Card.Body>
                                                    <Tabs
                                                        activeKey={activeTab[entry.id] || 'view'}
                                                        onSelect={(k) => setActiveTab(prev => ({
                                                            ...prev,
                                                            [entry.id]: k
                                                        }))}
                                                        className="mb-3"
                                                        justify
                                                    >
                                                        <Tab eventKey="view" title="📄 View">
                                                            <Table striped bordered hover responsive size="sm"
                                                                   className="mt-2">
                                                                <thead className="table-light">
                                                                <tr>
                                                                    <th>#</th>
                                                                    <th>SR No</th>
                                                                    <th>Description</th>
                                                                    <th className="text-end">Qty</th>
                                                                    <th>Unit</th>
                                                                    <th className="text-end">CIF FC</th>
                                                                    <th className="text-end">CIF INR</th>
                                                                </tr>
                                                                </thead>
                                                                <tbody>
                                                                {(entry.import_license || []).map((item, idx) => (
                                                                    <tr key={idx}>
                                                                        <td>{idx + 1}</td>
                                                                        <td>{item.serial_number || '-'}</td>
                                                                        <td>{item.description || '-'}</td>
                                                                        <td className="text-end">{formatNumber(item.quantity)}</td>
                                                                        <td>{item.unit}</td>
                                                                        <td className="text-end">{formatNumber(item.cif_fc)}</td>
                                                                        <td className="text-end">{formatNumber(item.cif_inr)}</td>
                                                                    </tr>
                                                                ))}
                                                                </tbody>
                                                            </Table>
                                                        </Tab>
                                                        <Tab eventKey="edit" title="✏️ Edit">
                                                            <LicenseForm entry={entry} onSaved={handleSaved}/>
                                                        </Tab>
                                                    </Tabs>
                                                </Card.Body>
                                            </Collapse>
                                        </Card>
                                    ))}
                                </div>
                            );
                        })}
                    </Accordion.Body>
                </Accordion.Item>
            ))}
        </Accordion>
    );
};

export default GroupedAccordionLicense;