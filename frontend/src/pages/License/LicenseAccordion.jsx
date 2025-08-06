import React, {useRef, useState} from 'react';
import {Accordion, Card, Collapse, Tab, Table, Tabs} from 'react-bootstrap';
import LicenseForm from './LicenseForm'; // your existing form
import dayjs from 'dayjs';

const LicenseAccordion = ({
                              groups,
                              allExpanded,
                              expanded,
                              toggle,
                              selectedIds,
                              toggleSelect,
                              toggleSelectAll,
                              onSaved,
                          }) => {
    const [activeTab, setActiveTab] = useState({});
    const [editMode, setEditMode] = useState({});
    const focusedRef = useRef({});

    const handleSaved = (licenseId) => {
        onSaved(licenseId);
        setTimeout(() => {
            setEditMode(prev => ({...prev, [licenseId]: false}));
            setActiveTab(prev => ({...prev, [licenseId]: 'view'}));
            focusedRef.current[licenseId]?.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 100);
    };

    const formatNumber = (val) =>
        val != null ? Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2}) : '-';

    return (
        <Accordion alwaysOpen activeKey={allExpanded ? Object.keys(groups) : []}>
            {Object.entries(groups).map(([groupKey, metadata], grpIdx) => (
                <Accordion.Item eventKey={`group-${grpIdx}`} key={groupKey} className="mb-3 border-primary">
                    <Accordion.Header className="bg-light text-primary">
                        <div className="w-100">
                            <div className="fw-bold fs-5 text-primary">{groupKey}</div>
                            <div className="ms-2 small text-muted">{`Licenses: ${metadata.licenses.length}`}</div>
                        </div>
                    </Accordion.Header>
                    <Accordion.Body>
                        {metadata.licenses.map((lic) => (
                            <Card
                                key={lic.id}
                                className="mb-3 shadow-sm border-secondary"
                                ref={(el) => (focusedRef.current[lic.id] = el)}
                            >
                                <Card.Header
                                    className="d-flex align-items-center justify-content-between bg-white"
                                    onClick={() => toggle(lic.id)}
                                    style={{cursor: 'pointer'}}
                                >
                                    <div>
                                        <strong className="text-primary">{lic.license_number}</strong>
                                        <span
                                            className="ms-3">Date: {dayjs(lic.license_date).format('YYYY-MM-DD')}</span>
                                        <span
                                            className="ms-3">Expiry: {dayjs(lic.license_expiry_date).format('YYYY-MM-DD')}</span>
                                        <span className="ms-3">Balance CIF: {formatNumber(lic.balance_cif)}</span>
                                    </div>
                                    <div>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(lic.id)}
                                            onChange={() => toggleSelect(lic.id)}
                                        />
                                    </div>
                                </Card.Header>
                                <Collapse in={!!expanded[lic.id]}>
                                    <Card.Body>
                                        <Tabs
                                            activeKey={activeTab[lic.id] || 'view'}
                                            onSelect={(k) => setActiveTab((prev) => ({...prev, [lic.id]: k}))}
                                            className="mb-3"
                                            justify
                                        >
                                            <Tab eventKey="view" title="📄 View">
                                                <Table size="sm" striped bordered hover responsive>
                                                    <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Type</th>
                                                        <th>ID</th>
                                                        <th>Quantity</th>
                                                        <th>CIF FC</th>
                                                        <th>CIF INR</th>
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    {[
                                                        ...lic.export_items.map((e, idx) => ({
                                                            ...e,
                                                            _type: 'Export',
                                                            _idx: idx + 1,
                                                        })),
                                                        ...lic.import_items.map((i, idx) => ({
                                                            ...i,
                                                            _type: 'Import',
                                                            _idx: lic.export_items.length + idx + 1,
                                                        })),
                                                    ].map((row) => (
                                                        <tr key={`${row._type}-${row.id}`}>
                                                            <td>{row._idx}</td>
                                                            <td>{row._type}</td>
                                                            <td>{row.id}</td>
                                                            <td className="text-end">{formatNumber(row.net_quantity || row.quantity)}</td>
                                                            <td className="text-end">{formatNumber(row.cif_fc)}</td>
                                                            <td className="text-end">{formatNumber(row.cif_inr)}</td>
                                                        </tr>
                                                    ))}
                                                    </tbody>
                                                </Table>
                                            </Tab>

                                            <Tab eventKey="edit" title="✏️ Edit">
                                                <LicenseForm
                                                    licenseId={lic.id}
                                                    onSuccess={handleSaved}
                                                />
                                            </Tab>
                                        </Tabs>
                                    </Card.Body>
                                </Collapse>
                            </Card>
                        ))}
                    </Accordion.Body>
                </Accordion.Item>
            ))}
        </Accordion>
    );
};

export default LicenseAccordion;
