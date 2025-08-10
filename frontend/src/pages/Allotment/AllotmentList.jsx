import React, {useState} from 'react';
import {Badge, Card, Col, Collapse, Container, Row, Table} from 'react-bootstrap';
import ListControls from '../../components/ListControls';
import AllotmentFilters from './AllotmentFilters';
import AllotmentForm from './AllotmentForm';
import useAllotmentListManager from '../../hooks/Allotment/useAllotmentListManager';
import './AllotmentList.css';

const HeaderField = ({label, children}) => (
    <div className="me-3 small text-nowrap"><strong>{label}:</strong> {children}</div>
);

const formatNumber = (val) => {
    if (val === null || val === undefined) return '-';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

const AllotmentList = () => {
    const {
        entries,
        loading,
        sortField,
        sortOrder,
        sortOptions,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        setPage,
        filters,
        setFilters,
        handleReset,
        updateSingleEntry,
        fetchData,
        loadMoreRef,
    } = useAllotmentListManager();

    const [expanded, setExpanded] = useState({});
    const [newEntry, setNewEntry] = useState(null);

    const toggle = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

    return (
        <Container className="mt-4">
            <ListControls
                title="📦 Allotments"
                search={searchQuery}
                setSearch={setSearchQuery}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                sortOptions={sortOptions}
                setPage={setPage}
                handleReset={handleReset}
                dataExport={false}
                Filters={React.Children.toArray(<AllotmentFilters filters={filters} setFilters={setFilters}/>)}
                onAddNewClick={() =>
                    setNewEntry({
                        company: null,
                        port: null,
                        related_company: null,
                        required_quantity: '',
                        unit_value_per_unit: '',
                        item_name: '',
                        contact_person: '',
                        contact_number: '',
                        invoice: '',
                        estimated_arrival_date: '',
                        bl_detail: '',
                        allotment_details: [
                            {
                                sr_number: null,
                                qty: '',
                                cif_fc: '',
                                cif_inr: '',
                                is_boe: false,
                            },
                        ],
                    })
                }
            />

            {newEntry && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white">New Allotment</Card.Header>
                    <Card.Body>
                        <AllotmentForm
                            entry={newEntry}
                            isNew
                            onClose={() => setNewEntry(null)}
                            onSaved={() => {
                                setNewEntry(null);
                                fetchData();
                            }}
                        />
                    </Card.Body>
                </Card>
            )}

            {entries.map((a) => (
                <Card key={a.id} className="mb-3 shadow-sm">
                    <Card.Header className="bg-white">
                        <div
                            className="d-flex align-items-center justify-content-between"
                            onClick={() => toggle(a.id)}
                            style={{cursor: 'pointer'}}
                        >
                            <div className="d-flex flex-wrap align-items-center">
                                <HeaderField label="Company">{a.company?.name}</HeaderField>
                                <HeaderField label="Item">{a.item_name}</HeaderField>
                                <HeaderField label="Port">{a.port?.name || '-'}</HeaderField>
                                <HeaderField label="Invoice">{a.invoice || '-'}</HeaderField>
                                <HeaderField label="ETA">{a.estimated_arrival_date || '-'}</HeaderField>
                            </div>
                            <div className="text-end">
                                <Badge bg={Number(a.balanced_quantity) > 0 ? 'warning' : 'success'} className="me-2">
                                    Balance: {formatNumber(a.balanced_quantity)}
                                </Badge>
                                <Badge bg="info" className="me-2">
                                    Allotted Qty: {formatNumber(a.alloted_quantity)}
                                </Badge>
                                <Badge bg="secondary">
                                    Allotted $: {formatNumber(a.allotted_value)}
                                </Badge>
                            </div>
                        </div>
                    </Card.Header>
                    <Collapse in={!!expanded[a.id]}>
                        <Card.Body>
                            <Row className="mb-3">
                                <Col md={3}><strong>Required Qty:</strong> {formatNumber(a.required_quantity)}</Col>
                                <Col md={3}><strong>Unit Value/Unit:</strong> {formatNumber(a.unit_value_per_unit)}
                                </Col>
                                <Col md={3}><strong>Required Value:</strong> {formatNumber(a.required_value)}</Col>
                                <Col md={3}><strong>BL Detail:</strong> {a.bl_detail || '-'}</Col>
                            </Row>
                            <Row className="mb-3">
                                <Col
                                    md={6}><strong>Contact:</strong> {a.contact_person || '-'} {a.contact_number ? `(${a.contact_number})` : ''}
                                </Col>
                                <Col md={6}><strong>DFIA:</strong> {a.dfia_list || '-'}</Col>
                            </Row>

                            <h6>Lines</h6>
                            <Table bordered size="sm" responsive>
                                <thead className="table-light">
                                <tr>
                                    <th>#</th>
                                    <th>SR</th>
                                    <th>Description</th>
                                    <th>HS</th>
                                    <th>Unit</th>
                                    <th>Qty</th>
                                    <th>CIF $</th>
                                    <th>CIF ₹</th>
                                    <th>BOE?</th>
                                    <th>License</th>
                                    <th>Regn No/Date</th>
                                    <th>Exporter</th>
                                    <th>Port</th>
                                </tr>
                                </thead>
                                <tbody>
                                {(a.allotment_details || []).map((d, i) => (
                                    <tr key={d.id || i}>
                                        <td>{i + 1}</td>
                                        <td>{d.serial_number}</td>
                                        <td>{d.description}</td>
                                        <td>{d.hs_code}</td>
                                        <td>{d.unit}</td>
                                        <td className="text-end">{formatNumber(d.qty)}</td>
                                        <td className="text-end">{formatNumber(d.cif_fc)}</td>
                                        <td className="text-end">{formatNumber(d.cif_inr)}</td>
                                        <td className="text-center">{d.is_boe ? '✔' : ''}</td>
                                        <td>{d.license_number}</td>
                                        <td>{d.registration_number} / {d.registration_date}</td>
                                        <td>{d.exporter_name}</td>
                                        <td>{d.port_name} ({d.port_code})</td>
                                    </tr>
                                ))}
                                </tbody>
                            </Table>

                            <div className="text-end">
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => setExpanded((prev) => ({...prev, [a.id]: false}))}>
                                    Close
                                </button>
                                <button
                                    className="btn btn-primary btn-sm ms-2"
                                    onClick={() => setExpanded((prev) => ({...prev, [a.id]: true}))}>
                                    Expand
                                </button>
                            </div>

                            <hr className="my-3"/>

                            <h6 className="mb-2">Edit</h6>
                            <AllotmentForm
                                entry={a}
                                onSaved={() => {
                                    updateSingleEntry(a.id);
                                }}
                            />
                        </Card.Body>
                    </Collapse>
                </Card>
            ))}

            <div ref={loadMoreRef} className="text-center my-4" style={{minHeight: '40px'}}>
                {loading && <div className="spinner-border text-primary" role="status"/>}
                {!loading && !entries.length && <span className="text-muted">No allotments found</span>}
            </div>
        </Container>
    );
};

export default AllotmentList;
