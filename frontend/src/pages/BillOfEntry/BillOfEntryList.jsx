// BillOfEntryList.jsx
import React, {useEffect, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Button, Card, Col, Collapse, Container, Form, Row, Spinner} from 'react-bootstrap';
import {toast} from 'react-toastify';
import BillOfEntryForm from './BillOfEntryForm';
import ListControls from '../../components/ListControls';
import AsyncCompanySelect from './AsyncCompanySelect';
import AsyncPortSelect from './AsyncPortSelect';

const BillOfEntryList = () => {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        company: null,
        port: null,
        invoice_no: '',
        product_name: '',
        from_date: '',
        to_date: ''
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [newEntry, setNewEntry] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                search: searchQuery,
                ...(filters.company ? {company: filters.company.id} : {}),
                ...(filters.port ? {port: filters.port.id} : {}),
                ...(filters.invoice_no ? {invoice_no: filters.invoice_no} : {}),
                ...(filters.product_name ? {product_name: filters.product_name} : {}),
                ...(filters.from_date ? {from_date: filters.from_date} : {}),
                ...(filters.to_date ? {to_date: filters.to_date} : {})
            };
            const res = await axios.get('/api/bill-of-entries/', {params});
            setEntries(res.data.results);
            setTotalPages(Math.ceil(res.data.count / 10));
        } catch (err) {
            toast.error('Failed to fetch BOE data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, filters, searchQuery]);

    const toggle = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

    return (
        <Container className="mt-4">
            <ListControls
                title="📄 Bill of Entry"
                search={searchQuery}
                setSearch={setSearchQuery}
                filters={[
                    <AsyncCompanySelect
                        key="company"
                        value={filters.company}
                        onChange={(v) => setFilters(prev => ({...prev, company: v}))}
                    />,
                    <AsyncPortSelect
                        key="port"
                        value={filters.port}
                        onChange={(v) => setFilters(prev => ({...prev, port: v}))}
                    />,
                    <Form.Control
                        key="invoice"
                        size="sm"
                        placeholder="Invoice No"
                        value={filters.invoice_no}
                        onChange={(e) => setFilters(prev => ({...prev, invoice_no: e.target.value}))}
                    />,
                    <Form.Control
                        key="product"
                        size="sm"
                        placeholder="Product Name"
                        value={filters.product_name}
                        onChange={(e) => setFilters(prev => ({...prev, product_name: e.target.value}))}
                    />,
                    <Form.Control
                        key="from_date"
                        size="sm"
                        type="date"
                        value={filters.from_date}
                        onChange={(e) => setFilters(prev => ({...prev, from_date: e.target.value}))}
                    />,
                    <Form.Control
                        key="to_date"
                        size="sm"
                        type="date"
                        value={filters.to_date}
                        onChange={(e) => setFilters(prev => ({...prev, to_date: e.target.value}))}
                    />
                ]}
                setPage={setPage}
                onAddNew={() => {
                    setNewEntry({
                        bill_of_entry_number: '',
                        bill_of_entry_date: '',
                        port: null,
                        exchange_rate: '',
                        company: null,
                        invoice_no: '',
                        product_name: '',
                        item_details: [
                            {
                                sr_number: '',
                                sr_number_display: '',
                                transaction_type: 'D',
                                qty: '',
                                cif_fc: '',
                                cif_inr: ''
                            }
                        ],
                    });
                }}
            />

            {newEntry && (
                <Card className="mb-3 border-success">
                    <Card.Header className="bg-success text-white">New Bill of Entry</Card.Header>
                    <Card.Body>
                        <BillOfEntryForm
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

            {loading ? <Spinner animation="border"/> : entries.map(entry => (
                <Card key={entry.id} className="mb-3 shadow-sm">
                    <Card.Header onClick={() => toggle(entry.id)} style={{cursor: 'pointer'}}>
                        <Row>
                            <Col>BOE <strong>#{entry.bill_of_entry_number}</strong></Col>
                            <Col>Date: <strong>{entry.bill_of_entry_date}</strong> </Col>
                            <Col>Port: <strong>{entry.port?.code || '-'}</strong></Col>
                            <Col>Company: <strong>{entry.company?.name || '-'}</strong></Col>
                            <Col>Qty: <strong>{entry.get_total_quantity}</strong></Col>
                            <Col>CIF <strong>$: {entry.get_total_fc}</strong></Col>
                            <Col className="text-end">INR <strong>₹{entry.get_total_inr.toLocaleString()}</strong></Col>
                        </Row>
                        <hr/>
                        <Row className="mt-1">
                            <Col>Allotments: <strong>{entry.allotment?.map(a => a?.item_name).join(', ') || '-'} | {entry.allotment?.map(a => a?.invoice).join(', ') || '-'}</strong></Col>
                            <Col>Product Name <strong>{entry.product_name}</strong></Col>
                            <Col>Invoice: <strong>{entry.invoice_no}</strong></Col>
                            <Col>Exchange Rate: <strong>{entry.exchange_rate || '-'}</strong></Col>
                        </Row>
                    </Card.Header>
                    <Collapse in={!!expanded[entry.id]}>
                        <Card.Body className="bg-light border-top">
                            <BillOfEntryForm
                                entry={entry}
                                onSaved={fetchData}
                            />
                        </Card.Body>
                    </Collapse>
                </Card>
            ))}

            {!loading && totalPages > 1 && (
                <div className="d-flex justify-content-center gap-3 mt-4">
                    <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                    <span>Page {page} of {totalPages}</span>
                    <Button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
                </div>
            )}
        </Container>
    );
};

export default BillOfEntryList;