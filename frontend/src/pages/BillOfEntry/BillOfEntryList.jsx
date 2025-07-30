import React, {useCallback, useEffect, useState} from 'react';
import {Card, Col, Collapse, Container, Form, Row} from 'react-bootstrap';
import Accordion from 'react-bootstrap/Accordion';
import {toast} from 'react-toastify';
import BillOfEntryForm from './BillOfEntryForm';
import ListControls from '../../components/ListControls';
import AsyncCompanySelect from './AsyncCompanySelect';
import AsyncPortSelect from './AsyncPortSelect';
import PaginationControls from '../../components/PaginationControls';
import useUrlSync from '../../hooks/useUrlSync';
import axios from '../../api/axiosInstance';
import YesNoRadio from '../../components/YesNoRadio';

const BillOfEntryList = () => {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sortField, setSortField] = useState('bill_of_entry_date');
    const [sortOrder, setSortOrder] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [allExpanded, setAllExpanded] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);

    const [filters, setFilters] = useState({
        company_objs: [],
        exclude_company_objs: [],
        port_objs: [],
        product_name: '',
        from_date: '',
        to_date: '',
        is_invoice: false,
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

    const groupEntries = (entries) => {
        const groups = {};
        entries.forEach(entry => {
            const companyName = entry.company?.name || 'Unknown Company';
            const date = new Date(entry.bill_of_entry_date);
            const month = date.toLocaleString('default', {month: 'long', year: 'numeric'});
            const portName = entry.port?.code || 'Unknown Port';

            const qty = parseFloat(entry.get_total_quantity || 0);
            const cif_fc = parseFloat(entry.get_total_fc || 0);
            const cif_inr = parseFloat(entry.get_total_inr || 0);

            if (!groups[companyName]) groups[companyName] = {};
            if (!groups[companyName][month]) groups[companyName][month] = {};
            if (!groups[companyName][month][portName]) {
                groups[companyName][month][portName] = {entries: [], summary: {qty: 0, fc: 0, inr: 0}};
            }

            groups[companyName][month][portName].entries.push(entry);
            groups[companyName][month][portName].summary.qty += qty;
            groups[companyName][month][portName].summary.fc += cif_fc;
            groups[companyName][month][portName].summary.inr += cif_inr;
        });
        return groups;
    };

    const fetchData = useCallback(async () => {
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
                ...(filters.product_name && {product_name: filters.product_name}),
                ...(filters.from_date && {from_date: filters.from_date}),
                ...(filters.to_date && {to_date: filters.to_date}),
                ...(typeof filters.is_invoice === 'boolean' && {is_invoice: filters.is_invoice.toString()}),
            };

            const res = await axios.get('/api/bill-of-entries/', {params});
            setEntries(res.data.results);
            setTotalPages(Math.ceil(res.data.count / 10));
        } catch (err) {
            toast.error('Failed to fetch BOE data');
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, sortField, sortOrder, filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggle = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = (ids) => {
        const allSelected = ids.every(id => selectedIds.includes(id));
        setSelectedIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} entries?`)) return;
        try {
            await axios.post('/api/bill-of-entries/bulk-delete/', {ids: selectedIds});
            toast.success('Selected entries deleted');
            setSelectedIds([]);
            fetchData();
        } catch (err) {
            toast.error('Failed to delete selected entries');
        }
    };

    const buildExportParams = () => {
        const params = new URLSearchParams({
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
            ...(filters.product_name && {product_name: filters.product_name}),
            ...(filters.from_date && {from_date: filters.from_date}),
            ...(filters.to_date && {to_date: filters.to_date}),
            ...(typeof filters.is_invoice === 'boolean' && {is_invoice: filters.is_invoice.toString()}),
        });
        return params.toString();
    };

    const handleExportXLSX = async () => {
        try {
            const res = await axios.get(`/api/bill-of-entries/export-excel/?${buildExportParams()}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bill_of_entries.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Failed to export Excel');
        }
    };

    const handleExportPDF = async () => {
        try {
            const res = await axios.get(`/api/bill-of-entries/export/pdf?${buildExportParams()}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], {type: 'application/pdf'});
            const url = window.URL.createObjectURL(blob);
            const newTab = window.open();
            if (newTab) newTab.location.href = url;
            else toast.error('Popup blocked! Please allow popups.');
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (err) {
            toast.error('Failed to export PDF');
        }
    };

    const sortOptions = [
        {label: 'BOE Date ⬇️', value: 'bill_of_entry_date:desc'},
        {label: 'BOE Date ⬆️', value: 'bill_of_entry_date:asc'},
        {label: 'BOE Number ⬇️', value: 'bill_of_entry_number:desc'},
        {label: 'BOE Number ⬆️', value: 'bill_of_entry_number:asc'},
        {label: 'Modified On ⬇️', value: 'modified_on:desc'},
        {label: 'Modified On ⬆️', value: 'modified_on:asc'},
    ];

    const handleReset = () => {
        setSearchQuery('');
        setSortField('bill_of_entry_date');
        setSortOrder('desc');
        setFilters({
            company_objs: [],
            exclude_company_objs: [],
            port_objs: [],
            product_name: '',
            from_date: '',
            to_date: '',
            is_invoice: false,
        });
        setPage(1);
        setTimeout(fetchData, 0);
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
                sortOptions={sortOptions}
                setPage={setPage}
                handleReset={handleReset}
                handleExportCSV={loading ? undefined : handleExportXLSX}
                handleExportPDF={loading ? undefined : handleExportPDF}
                dataExport={true}
                Filters={[
                    <AsyncCompanySelect key="company" value={filters.company_objs} isMulti
                                        onChange={v => setFilters(prev => ({...prev, company_objs: v}))}/>,
                    <AsyncCompanySelect key="exclude_company" value={filters.exclude_company_objs} isMulti
                                        placeholder="Exclude Company"
                                        onChange={v => setFilters(prev => ({...prev, exclude_company_objs: v}))}/>,
                    <AsyncPortSelect key="port" value={filters.port_objs} isMulti
                                     onChange={v => setFilters(prev => ({...prev, port_objs: v}))}/>,
                    <Form.Control key="product" size="sm" placeholder="Product Name" value={filters.product_name}
                                  onChange={e => setFilters(prev => ({...prev, product_name: e.target.value}))}/>,
                    <YesNoRadio key="is_invoice" label="Has Invoice?" value={filters.is_invoice}
                                onChange={val => setFilters(prev => ({...prev, is_invoice: val}))}/>,
                    <Form.Control key="from_date" size="sm" type="date" value={filters.from_date}
                                  onChange={e => setFilters(prev => ({...prev, from_date: e.target.value}))}/>,
                    <Form.Control key="to_date" size="sm" type="date" value={filters.to_date}
                                  onChange={e => setFilters(prev => ({...prev, to_date: e.target.value}))}/>,
                ]}
                onAddNewClick={() => setNewEntry({
                    bill_of_entry_number: '',
                    bill_of_entry_date: '',
                    port: null,
                    exchange_rate: '',
                    company: null,
                    invoice_no: '',
                    product_name: '',
                    item_details: [{sr_number: '', transaction_type: 'D', qty: '', cif_fc: '', cif_inr: ''}]
                })}
            />

            {selectedIds.length > 0 && (
                <div className="d-flex justify-content-end mb-2">
                    <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
                        Delete Selected ({selectedIds.length})
                    </button>
                </div>
            )}

            <div className="d-flex justify-content-end mb-2">
                <button className="btn btn-outline-primary btn-sm" onClick={() => setAllExpanded(prev => !prev)}>
                    {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
            </div>

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

            {!loading && (
                <Accordion alwaysOpen
                           activeKey={allExpanded ? Object.keys(groupEntries(entries)).map((_, i) => `company-${i}`) : []}>
                    {Object.entries(groupEntries(entries)).map(([company, months], companyIndex) => (
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
                                                                <BillOfEntryForm entry={entry} onSaved={fetchData}/>
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
            )}

            <PaginationControls page={page} totalPages={totalPages} setPage={setPage} loading={loading}/>
        </Container>
    );
};

export default BillOfEntryList;
