import React, {useEffect, useState} from 'react';
import axios from '../../api/axiosInstance';
import {Card, Col, Collapse, Container, Form, Row, Spinner} from 'react-bootstrap';
import {toast} from 'react-toastify';
import BillOfEntryForm from './BillOfEntryForm';
import ListControls from '../../components/ListControls';
import AsyncCompanySelect from './AsyncCompanySelect';
import AsyncPortSelect from './AsyncPortSelect';
import PaginationControls from '../../components/PaginationControls';
import useUrlSync from '../../hooks/useUrlSync';

const BillOfEntryList = () => {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sortField, setSortField] = useState('bill_of_entry_date');
    const [sortOrder, setSortOrder] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        company_objs: [],
        exclude_company_objs: [],
        port_objs: [],
        invoice_no: '',
        product_name: '',
        from_date: '',
        to_date: '',
    });
    const [newEntry, setNewEntry] = useState(null);

    useUrlSync({
        page,
        setPage,
        search: searchQuery,
        setSearch: setSearchQuery,
        sortField,
        sortOrder,
        setSortField,
        setSortOrder,
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                search: searchQuery,
                ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
                ...(filters.company_objs.length > 0 && {
                    company__in: filters.company_objs.map(c => c.id).join(','),
                }),
                ...(filters.exclude_company_objs.length > 0 && {
                    exclude_company__in: filters.exclude_company_objs.map(c => c.id).join(','),
                }),
                ...(filters.port_objs.length > 0 && {
                    port__in: filters.port_objs.map(p => p.id).join(','),
                }),
                ...(filters.invoice_no && {invoice_no: filters.invoice_no}),
                ...(filters.product_name && {product_name: filters.product_name}),
                ...(filters.from_date && {from_date: filters.from_date}),
                ...(filters.to_date && {to_date: filters.to_date}),
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
    }, [page, filters, searchQuery, sortField, sortOrder]);

    const toggle = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

    const handleReset = () => {
        setSearchQuery('');
        setSortField('bill_of_entry_date');
        setSortOrder('desc');
        setFilters({
            company_objs: [],
            exclude_company_objs: [],
            port_objs: [],
            invoice_no: '',
            product_name: '',
            from_date: '',
            to_date: '',
        });
        setPage(1);
    };

    return (
        <Container className="mt-4">
            <ListControls
                title="📄 Bill of Entry"
                search={searchQuery}
                setSearch={setSearchQuery}
                sortField={sortField}
                sortOrder={sortOrder}
                setSortField={setSortField}
                setSortOrder={setSortOrder}
                setPage={setPage}
                handleReset={handleReset}
                Filters={[
                    <AsyncCompanySelect
                        key="company"
                        value={filters.company_objs}
                        isMulti={true}
                        placeholder="Select Company"
                        onChange={(v) => setFilters(prev => ({...prev, company_objs: v}))}
                    />,
                    <AsyncCompanySelect
                        key="exclude_company"
                        value={filters.exclude_company_objs}
                        isMulti={true}
                        placeholder="Exclude Company"
                        onChange={(v) => setFilters(prev => ({...prev, exclude_company_objs: v}))}
                    />,
                    <AsyncPortSelect
                        key="port"
                        value={filters.port_objs}
                        isMulti={true}
                        onChange={(v) => setFilters(prev => ({...prev, port_objs: v}))}
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
                    />,
                ]}
                onAddNewClick={() =>
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
                                cif_inr: '',
                            },
                        ],
                    })
                }
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

            {loading ? (
                <Spinner animation="border"/>
            ) : (
                entries.map(entry => (
                    <Card key={entry.id} className="mb-3 shadow-sm">
                        <Card.Header onClick={() => toggle(entry.id)} style={{cursor: 'pointer'}}>
                            <Row>
                                <Col>BOE <strong>#{entry.bill_of_entry_number}</strong></Col>
                                <Col>Date: <strong>{entry.bill_of_entry_date}</strong></Col>
                                <Col>Port: <strong>{entry.port?.code || '-'}</strong></Col>
                                <Col>Company: <strong>{entry.company?.name || '-'}</strong></Col>
                                <Col>Qty: <strong>{entry.get_total_quantity}</strong></Col>
                                <Col>CIF <strong>$: {entry.get_total_fc}</strong></Col>
                                <Col
                                    className="text-end">INR <strong>₹{entry.get_total_inr.toLocaleString()}</strong></Col>
                            </Row>
                            <hr/>
                            <Row className="mt-1">
                                <Col>Allotments: <strong>{entry.allotment?.map(a => a?.item_name).join(', ') || '-'}</strong></Col>
                                <Col>Invoices: <strong>{entry.allotment?.map(a => a?.invoice).join(', ') || '-'}</strong></Col>
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
                ))
            )}

            <PaginationControls
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                loading={loading}
            />
        </Container>
    );
};

export default BillOfEntryList;
