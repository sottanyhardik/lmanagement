import React, {useRef, useState} from 'react';
import {Accordion, Badge, Card, Col, Collapse, Form, Row, Tab, Table, Tabs} from 'react-bootstrap';
import BillOfEntryForm from './BillOfEntryForm';
import TransferLetterForm from './TransferLetterForm';

const GroupedAccordion = ({
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
    const [editMode, setEditMode] = useState({});
    const focusedRef = useRef({});

    const handleSaved = (updatedEntry) => {
        onSaved(updatedEntry, {refreshGroup: true});
        if (updatedEntry?.id) {
            setTimeout(() => {
                setEditMode(prev => ({...prev, [updatedEntry.id]: false}));
                setActiveTab(prev => ({...prev, [updatedEntry.id]: 'view'}));
                focusedRef.current[updatedEntry.id]?.scrollIntoView({behavior: 'smooth', block: 'center'});
            }, 100);
        }
    };

    const formatNumber = (value) => {
        return value?.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '-';
    };

    const calculateTotals = (items) => {
        return items.reduce((acc, item) => {
            const qty = parseFloat(item.qty) || 0;
            const fc = parseFloat(item.cif_fc) || 0;
            const inr = parseFloat(item.cif_inr) || 0;
            return {
                qty: acc.qty + qty,
                fc: acc.fc + fc,
                inr: acc.inr + inr,
            };
        }, {qty: 0, fc: 0, inr: 0});
    };

    return (
        <Accordion alwaysOpen activeKey={allExpanded ? Object.keys(groups).map((_, i) => `company-${i}`) : []}>
            {Object.entries(groups).map(([company, months], companyIndex) => (
                <Accordion.Item eventKey={`company-${companyIndex}`} key={company}>
                    <Accordion.Header>
                        <div className="sticky-header w-100">
                            <strong className="text-primary fs-5">🏢 {company}</strong>
                        </div>
                    </Accordion.Header>
                    <Accordion.Body>
                        {Object.entries(months).map(([month, ports]) => (
                            <div key={month}>
                                <div className="sticky-header text-secondary fw-semibold mt-3 mb-2">📅 {month}</div>
                                {Object.entries(ports).map(([port, {entries: boes, summary}], portIndex) => (
                                    <div key={port} className="border rounded p-3 mb-4 bg-white shadow-sm">
                                        <div className="fw-bold text-dark mb-3">
                                            🌐 {port} — Total Qty: <Badge bg="info">{summary.qty.toFixed(2)}</Badge> |
                                            CIF $: <Badge bg="warning">{summary.fc.toFixed(2)}</Badge> | INR ₹<Badge
                                            bg="success">{summary.inr.toLocaleString()}</Badge>
                                        </div>

                                        <Form.Check
                                            type="checkbox"
                                            className="mb-2"
                                            label={`Select All (${boes.length})`}
                                            checked={boes.every(entry => selectedIds.includes(entry.id))}
                                            onChange={() => toggleSelectAll(boes.map(e => e.id))}
                                        />

                                        {boes.map(entry => (
                                            <Card key={entry.id} className="mb-3 shadow-sm border-0"
                                                  ref={el => focusedRef.current[entry.id] = el}>
                                                <Card.Header
                                                    className="d-flex align-items-center justify-content-between bg-light border rounded">
                                                    <Form.Check
                                                        type="checkbox"
                                                        className="me-2"
                                                        checked={selectedIds.includes(entry.id)}
                                                        onChange={() => toggleSelect(entry.id)}
                                                    />
                                                    <div onClick={() => toggle(entry.id)}
                                                         style={{cursor: 'pointer', flex: 1}}>
                                                        <Row className="gx-3">
                                                            <Col><strong>BOE
                                                                #{entry.bill_of_entry_number}</strong></Col>
                                                            <Col>Date: {entry.bill_of_entry_date}</Col>
                                                            <Col>Product: {entry.product_name}</Col>
                                                            <Col>Qty: {formatNumber(entry.get_total_quantity)}</Col>
                                                            <Col>CIF $: {formatNumber(entry.get_total_fc)}</Col>
                                                            <Col>Exc Rt: {formatNumber(entry.exchange_rate)}</Col>
                                                            <Col>Invoice: {entry.invoice_no || '-'}</Col>
                                                            <Col className="text-end">INR
                                                                ₹{formatNumber(entry.get_total_inr)}</Col>
                                                        </Row>
                                                    </div>
                                                </Card.Header>
                                                <Collapse in={!!expanded[entry.id]}>
                                                    <Card.Body className="bg-white border rounded border-top-0">
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
                                                                        <th className="text-end">Qty</th>
                                                                        <th className="text-end">CIF FC</th>
                                                                        <th className="text-end">CIF INR</th>
                                                                    </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                    {entry.item_details?.map((item, idx) => (
                                                                        <tr key={idx}
                                                                            className={(!item.sr_number || !item.qty || item.qty <= 0) ? 'table-danger' : ''}>
                                                                            <td>{idx + 1}</td>
                                                                            <td>{item.sr_number?.display_name || '-'}</td>
                                                                            <td className="text-end">{formatNumber(item.qty)}</td>
                                                                            <td className="text-end">{formatNumber(item.cif_fc)}</td>
                                                                            <td className="text-end">{formatNumber(item.cif_inr)}</td>
                                                                        </tr>
                                                                    ))}
                                                                    </tbody>
                                                                    <tfoot>
                                                                    {(() => {
                                                                        const totals = calculateTotals(entry.item_details);
                                                                        return (
                                                                            <tr className="table-light fw-bold">
                                                                                <td colSpan={2}>Total</td>
                                                                                <td className="text-end">{formatNumber(totals.qty)}</td>
                                                                                <td className="text-end">{formatNumber(totals.fc)}</td>
                                                                                <td className="text-end">{formatNumber(totals.inr)}</td>
                                                                            </tr>
                                                                        );
                                                                    })()}
                                                                    </tfoot>
                                                                </Table>
                                                            </Tab>
                                                            <Tab eventKey="edit" title="✏️ Edit">
                                                                <BillOfEntryForm entry={entry} onSaved={handleSaved}/>
                                                            </Tab>
                                                            <Tab eventKey="transfer_letter" title="📑 Generate TL">
                                                                <TransferLetterForm boe={entry} autoDownload/>
                                                            </Tab>
                                                            <Tab eventKey="invoice" title="🧾 Generate Invoice">
                                                                <div className="text-muted">Coming soon...</div>
                                                            </Tab>
                                                        </Tabs>
                                                    </Card.Body>
                                                </Collapse>
                                            </Card>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </Accordion.Body>
                </Accordion.Item>
            ))}
        </Accordion>
    );
};

export default GroupedAccordion;
