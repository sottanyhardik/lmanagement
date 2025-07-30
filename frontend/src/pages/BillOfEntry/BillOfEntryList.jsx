import React, {useCallback, useEffect, useState} from 'react';
import {useInView} from 'react-intersection-observer';
import {Card, Container, Form} from 'react-bootstrap';
import {toast} from 'react-toastify';
import BillOfEntryForm from './BillOfEntryForm';
import ListControls from '../../components/ListControls';
import AsyncCompanySelect from './AsyncCompanySelect';
import AsyncPortSelect from './AsyncPortSelect';
import useUrlSync from '../../hooks/useUrlSync';
import axios from '../../api/axiosInstance';
import YesNoRadio from '../../components/YesNoRadio';
import {groupEntries} from '../../utils/groupEntries';
import {useBulkSelect} from '../../hooks/useBulkSelect';
import DeleteSelectedButton from './DeleteSelectedButton';
import GroupedAccordion from './GroupedAccordion';

const BillOfEntryList = () => {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState('bill_of_entry_date');
    const [sortOrder, setSortOrder] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [allExpanded, setAllExpanded] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [newEntry, setNewEntry] = useState(null);

    const [filters, setFilters] = useState({
        company_objs: [],
        exclude_company_objs: [],
        port_objs: [],
        product_name: '',
        from_date: '',
        to_date: '',
        is_invoice: false,
    });

    const {selectedIds, toggleSelect, toggleSelectAll, clearSelection} = useBulkSelect();
    const {ref: loadMoreRef, inView} = useInView();

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

    const fetchData = useCallback(async () => {
        if (loading) return;
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
            const newEntries = res.data.results;
            const totalCount = res.data.count;

            console.log('Page:', page);
            console.log('New Entries:', newEntries.length);
            console.log('Total Count:', totalCount);
            console.log('Entries before:', entries.length);

            setEntries(prev => (page === 1 ? newEntries : [...prev, ...newEntries]));

            const loadedTotal = (page === 1 ? newEntries.length : entries.length + newEntries.length);
            setHasMore(loadedTotal < totalCount);
        } catch (err) {
            toast.error('Failed to fetch BOE data');
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, sortField, sortOrder, filters, entries.length]);

    useEffect(() => {
        setEntries([]);
        setHasMore(true);
        setPage(1);
    }, [searchQuery, sortField, sortOrder, filters]);

    useEffect(() => {
        fetchData();
    }, [page]);

    useEffect(() => {
        if (inView && hasMore && !loading) {
            setPage(prev => prev + 1);
        }
    }, [inView, hasMore, loading]);

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
        clearSelection();
        setEntries([]);
        setHasMore(true);
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
                                  onChange={e => setFilters(prev => ({...prev, to_date: e.target.value}))}/>
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

            <DeleteSelectedButton selectedIds={selectedIds} onDeleted={() => {
                clearSelection();
                fetchData();
            }}/>

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

            <GroupedAccordion
                groups={groupEntries(entries)}
                allExpanded={allExpanded}
                expanded={expanded}
                toggle={id => setExpanded(prev => ({...prev, [id]: !prev[id]}))}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                toggleSelectAll={toggleSelectAll}
                onSaved={fetchData}
            />

            <div ref={loadMoreRef} className="text-center my-4">
                {loading && <div className="spinner-border text-primary" role="status"/>}
                {!hasMore && <span className="text-muted">No more entries</span>}
            </div>
        </Container>
    );
};

export default BillOfEntryList;
