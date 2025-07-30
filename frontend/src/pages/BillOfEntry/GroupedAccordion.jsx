import React from 'react';
import {Accordion, Card, Col, Collapse, Form, Row} from 'react-bootstrap';
import BillOfEntryForm from './BillOfEntryForm';

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
    return (
        <Accordion alwaysOpen activeKey={allExpanded ? Object.keys(groups).map((_, i) => `company-${i}`) : []}>
            {Object.entries(groups).map(([company, months], companyIndex) => (
                <Accordion.Item eventKey={`company-${companyIndex}`} key={company}>
                    <Accordion.Header>
                        <div className="sticky-header w-100">
                            <strong>Company: {company}</strong>
                        </div>
                    </Accordion.Header>
                    <Accordion.Body>
                        {Object.entries(months).map(([month, ports]) => (
                            <div key={month}>
                                <div className="sticky-header text-primary fw-semibold mt-3">{month}</div>
                                {Object.entries(ports).map(([port, {entries: boes, summary}], portIndex) => (
                                    <div key={port} className="border rounded p-2 mb-3 bg-white shadow-sm">
                                        <div className="sticky-header fw-bold text-dark mb-2">
                                            {port} — Total Qty: {summary.qty.toFixed(2)} | CIF
                                            $: {summary.fc.toFixed(2)} | INR ₹{summary.inr.toLocaleString()}
                                        </div>

                                        <Form.Check
                                            type="checkbox"
                                            className="mb-2"
                                            label={`Select All (${boes.length})`}
                                            checked={boes.every(entry => selectedIds.includes(entry.id))}
                                            onChange={() => toggleSelectAll(boes.map(e => e.id))}
                                        />

                                        {boes.map(entry => (
                                            <Card key={entry.id} className="mb-2 shadow-sm">
                                                <Card.Header
                                                    className="d-flex align-items-center justify-content-between">
                                                    <Form.Check
                                                        type="checkbox"
                                                        className="me-2"
                                                        checked={selectedIds.includes(entry.id)}
                                                        onChange={() => toggleSelect(entry.id)}
                                                    />
                                                    <div onClick={() => toggle(entry.id)}
                                                         style={{cursor: 'pointer', flex: 1}}>
                                                        <Row>
                                                            <Col>BOE #{entry.bill_of_entry_number}</Col>
                                                            <Col>Date: {entry.bill_of_entry_date}</Col>
                                                            <Col>Qty: {entry.get_total_quantity}</Col>
                                                            <Col>Product Name: {entry.product_name}</Col>
                                                            <Col>CIF $: {entry.get_total_fc}</Col>
                                                            <Col className="text-end">INR
                                                                ₹{entry.get_total_inr.toLocaleString()}</Col>
                                                        </Row>
                                                    </div>
                                                </Card.Header>
                                                <Collapse in={!!expanded[entry.id]}>
                                                    <Card.Body className="bg-light border-top">
                                                        <BillOfEntryForm entry={entry} onSaved={onSaved}/>
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
