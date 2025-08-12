// components/GroupedAccordion.jsx
import React, {useRef, useState} from 'react';
import {Accordion, Badge, Card, Col, Collapse, Form, Row, Tab, Table, Tabs} from 'react-bootstrap';
import BillOfEntryForm from './BillOfEntryForm';
import TransferLetterForm from './TransferLetterForm';
import InvoiceForm from './InvoiceForm';

const GroupedAccordion = ({
                              groups,             // { [company]: { items: { [item]: { ports: { [port]: {entries, summary}}, summary } }, totalSummary } }
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

    const handleSaved = (entryId) => {
        if (!entryId) return;
        onSaved(entryId);
        setTimeout(() => {
            setEditMode((prev) => ({...prev, [entryId]: false}));
            setActiveTab((prev) => ({...prev, [entryId]: 'view'}));
            focusedRef.current[entryId]?.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 100);
    };

    const formatNumber = (value) =>
        (Number.isFinite(Number(value))
            ? Number(value).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})
            : '-');

    const calculateTotals = (items) =>
        items.reduce(
            (acc, item) => {
                const qty = parseFloat(item.qty) || 0;
                const fc = parseFloat(item.cif_fc) || 0;
                const inr = parseFloat(item.cif_inr) || 0;
                return {qty: acc.qty + qty, fc: acc.fc + fc, inr: acc.inr + inr};
            },
            {qty: 0, fc: 0, inr: 0}
        );

    return (
        <Accordion
            alwaysOpen
            activeKey={allExpanded ? Object.keys(groups).map((_, i) => `company-${i}`) : []}
        >
            {Object.entries(groups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([company, {items, totalSummary}], companyIndex) => (
                    <Accordion.Item
                        eventKey={`company-${companyIndex}`}
                        key={company}
                        className="border border-primary mb-3"
                    >
                        <Accordion.Header className="bg-light text-primary">
                            <div className="w-100">
                                <div className="fw-bold fs-5 text-primary">🏢 {company}</div>
                                <div className="ms-2 small text-muted">
                                    Total Qty: <Badge
                                    bg="primary">{formatNumber(totalSummary.qty)}</Badge> &nbsp;|&nbsp;
                                    CIF $: <Badge bg="info">{formatNumber(totalSummary.fc)}</Badge> &nbsp;|&nbsp;
                                    INR ₹<Badge bg="success">{formatNumber(totalSummary.inr)}</Badge>
                                </div>
                            </div>
                        </Accordion.Header>

                        <Accordion.Body className="bg-white">
                            {Object.entries(items)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([itemName, {ports, summary}]) => (
                                    <div key={itemName} className="p-3 mb-4 border rounded border-info bg-light-subtle">
                                        <div className="fw-semibold text-info mb-2">
                                            🧩 Item: <span className="text-dark">{itemName}</span> — &nbsp;
                                            Qty: <Badge bg="primary">{formatNumber(summary.qty)}</Badge> &nbsp;|&nbsp;
                                            CIF $: <Badge bg="info">{formatNumber(summary.fc)}</Badge> &nbsp;|&nbsp;
                                            INR ₹<Badge bg="success">{formatNumber(summary.inr)}</Badge>
                                        </div>

                                        {Object.entries(ports)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([portCode, {entries: boes, summary: portSummary}]) => (
                                                <div key={portCode}
                                                     className="border rounded border-primary p-3 mb-4 bg-light shadow-sm">
                                                    <div className="fw-semibold text-primary mb-3">
                                                        🌐 Port: {portCode} — &nbsp;
                                                        Qty: <Badge
                                                        bg="primary">{formatNumber(portSummary.qty)}</Badge> &nbsp;|&nbsp;
                                                        CIF $: <Badge
                                                        bg="info">{formatNumber(portSummary.fc)}</Badge> &nbsp;|&nbsp;
                                                        INR ₹<Badge bg="success">{formatNumber(portSummary.inr)}</Badge>
                                                    </div>

                                                    <Form.Check
                                                        type="checkbox"
                                                        className="mb-2"
                                                        label={`Select All (${boes.length})`}
                                                        checked={boes.length > 0 && boes.every(e => selectedIds.includes(e.id))}
                                                        onChange={() => toggleSelectAll(boes.map(e => e.id))}
                                                    />

                                                    {boes.map((entry) => (
                                                        <Card
                                                            key={entry.id}
                                                            className="mb-3 shadow-sm border border-secondary"
                                                            ref={(el) => (focusedRef.current[entry.id] = el)}
                                                        >
                                                            <Card.Header
                                                                className="d-flex align-items-center justify-content-between bg-white border-bottom">
                                                                <Form.Check
                                                                    type="checkbox"
                                                                    className="me-2"
                                                                    checked={selectedIds.includes(entry.id)}
                                                                    onChange={() => toggleSelect(entry.id)}
                                                                />

                                                                {/* Clickable summary row to expand/collapse the card */}
                                                                <div
                                                                    onClick={() => toggle(entry.id)}
                                                                    style={{cursor: 'pointer', flex: 1}}
                                                                >
                                                                    <Row
                                                                        className="gx-3 flex-nowrap overflow-auto align-items-center small text-nowrap">
                                                                        <Col xs="auto" className="flex-shrink-0">
                                                                            <strong className="text-primary">BOE
                                                                                #{entry.bill_of_entry_number}</strong>
                                                                        </Col>
                                                                        <Col xs="auto" className="flex-shrink-0">
                                                                            Date: {entry.bill_of_entry_date}
                                                                        </Col>
                                                                        <Col xs="2" className="flex-shrink-0">
                                                                            Qty: {formatNumber(entry.get_total_quantity)}
                                                                        </Col>
                                                                        <Col xs="2" className="flex-shrink-0">
                                                                            CIF $: {formatNumber(entry.get_total_fc)}
                                                                        </Col>
                                                                        <Col xs="auto" className="flex-shrink-0">
                                                                            Exc Rt: {formatNumber(entry.exchange_rate)}
                                                                        </Col>
                                                                        <Col xs="2"
                                                                             className="flex-shrink-0 text-success">
                                                                            INR ₹{formatNumber(entry.get_total_inr)}
                                                                        </Col>
                                                                        <Col xs="2" className="flex-shrink-0">
                                                                            Invoice: {entry.invoice_no || '-'}
                                                                        </Col>
                                                                    </Row>
                                                                </div>
                                                            </Card.Header>

                                                            <Collapse in={!!expanded[entry.id]}>
                                                                <Card.Body className="bg-white border-top-0">
                                                                    <Tabs
                                                                        activeKey={activeTab[entry.id] || 'view'}
                                                                        onSelect={(k) =>
                                                                            setActiveTab((prev) => ({
                                                                                ...prev,
                                                                                [entry.id]: k
                                                                            }))
                                                                        }
                                                                        className="mb-3"
                                                                        justify
                                                                    >
                                                                        <Tab eventKey="view" title="📄 View">
                                                                            <Table striped bordered hover responsive
                                                                                   size="sm" className="mt-2">
                                                                                <thead className="table-light">
                                                                                <tr>
                                                                                    <th>#</th>
                                                                                    <th>SR No</th>
                                                                                    <th className="text-end">Qty</th>
                                                                                    <th className="text-end">CIF FC</th>
                                                                                    <th className="text-end">CIF INR
                                                                                    </th>
                                                                                </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                {entry.item_details?.map((item, idx) => (
                                                                                    <tr
                                                                                        key={idx}
                                                                                        className={
                                                                                            !item.sr_number || !item.qty || item.qty <= 0
                                                                                                ? 'table-danger'
                                                                                                : ''
                                                                                        }
                                                                                    >
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
                                                                                    const totals = calculateTotals(entry.item_details || []);
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
                                                                            <BillOfEntryForm entry={entry}
                                                                                             onSaved={handleSaved}/>
                                                                        </Tab>

                                                                        <Tab eventKey="transfer_letter"
                                                                             title="📑 Generate TL">
                                                                            <TransferLetterForm boe={entry}
                                                                                                autoDownload/>
                                                                        </Tab>

                                                                        <Tab eventKey="invoice"
                                                                             title="🧾 Generate Invoice">
                                                                            <InvoiceForm boe={entry}
                                                                                         onSaved={handleSaved}/>
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
