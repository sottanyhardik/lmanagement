import {useCallback, useEffect, useState} from 'react';
import {useInView} from 'react-intersection-observer';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import useUrlSync from './../useUrlSync';

const DEFAULT_SORT_FIELD = 'bill_of_entry_date';
const DEFAULT_SORT_ORDER = 'desc';

export const DEFAULT_FILTERS = {
    company_objs: [],
    exclude_company_objs: [],
    port_objs: [],
    exclude_port_objs: [],
    product_name: '',
    from_date: '',
    to_date: '',
    is_invoice: false,
};

export const sortOptions = [
    {label: 'BOE Date ⬇️', value: 'bill_of_entry_date:desc'},
    {label: 'BOE Date ⬆️', value: 'bill_of_entry_date:asc'},
    {label: 'BOE Number ⬇️', value: 'bill_of_entry_number:desc'},
    {label: 'BOE Number ⬆️', value: 'bill_of_entry_number:asc'},
    {label: 'Modified On ⬇️', value: 'modified_on:desc'},
    {label: 'Modified On ⬆️', value: 'modified_on:asc'},
];

const useBillOfEntryListManager = () => {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState(DEFAULT_SORT_FIELD);
    const [sortOrder, setSortOrder] = useState(DEFAULT_SORT_ORDER);
    const [searchQuery, setSearchQuery] = useState('');
    const [allExpanded, setAllExpanded] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [newEntry, setNewEntry] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [triggeredByFilter, setTriggeredByFilter] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

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
                ...(filters.exclude_port_objs.length > 0 && {
                    exclude_port__in: filters.exclude_port_objs.map(p => p.id).join(','),
                }),
                ...(filters.product_name && {product_name: filters.product_name}),
                ...(filters.from_date && {from_date: filters.from_date}),
                ...(filters.to_date && {to_date: filters.to_date}),
                ...(typeof filters.is_invoice === 'boolean' && {
                    is_invoice: filters.is_invoice.toString(),
                }),
            };

            const res = await axios.get('/api/bill-of-entries/', {params});
            const newEntries = res.data.results;
            const hasNextPage = res.data.next !== null;

            setEntries(prev => {
                if (page === 1) return newEntries;
                const combined = [...prev, ...newEntries];
                const uniqueEntries = Array.from(new Map(combined.map(e => [e.id, e])).values());
                return uniqueEntries;
            });
            setHasMore(hasNextPage);
        } catch (err) {
            toast.error('Failed to fetch BOE data');
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, sortField, sortOrder, filters]);

    useEffect(() => {
        setEntries([]);
        setPage(1);
        setHasMore(true);
        setTriggeredByFilter(true);
        setRefreshKey(prev => prev + 1);
    }, [searchQuery, sortField, sortOrder, filters]);

    useEffect(() => {
        fetchData();
    }, [page]);

    useEffect(() => {
        if (triggeredByFilter) {
            fetchData().then(() => setTriggeredByFilter(false));
        }
    }, [refreshKey]);

    useEffect(() => {
        const delay = 200;
        let timeout;
        if (inView && hasMore && !loading && !triggeredByFilter) {
            timeout = setTimeout(() => {
                setPage(prev => prev + 1);
            }, delay);
        }
        return () => clearTimeout(timeout);
    }, [inView, hasMore, loading, triggeredByFilter]);

    const updateSingleEntry = async (id) => {
        try {
            const {data} = await axios.get(`/api/bill-of-entries/${id}/`);
            setEntries(prev => prev.map(e => e.id === id ? data : e));
        } catch {
            try {
                const {data} = await axios.get(`/api/bill-of-entries/${id.id}/`);
                setEntries(prev => prev.map(e => e.id === id ? data : e));
            } catch (err) {
                toast.error('Failed to fetch entry');
                console.error(err);
            }
        }
    };

    const handleReset = () => {
        setSearchQuery('');
        setSortField(DEFAULT_SORT_FIELD);
        setSortOrder(DEFAULT_SORT_ORDER);
        setFilters(DEFAULT_FILTERS);
        setPage(1);
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
            ...(filters.exclude_port_objs.length > 0 && {
                exclude_port__in: filters.exclude_port_objs.map(p => p.id).join(','),
            }),
            ...(filters.product_name && {product_name: filters.product_name}),
            ...(filters.from_date && {from_date: filters.from_date}),
            ...(filters.to_date && {to_date: filters.to_date}),
            ...(typeof filters.is_invoice === 'boolean' && {
                is_invoice: filters.is_invoice.toString(),
            }),
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
            console.error('Export Excel failed:', error);
            toast.error('Failed to export Excel');
        }
    };

    const handleExportPDF = async () => {
        try {
            toast.info('Downloading PDF...');
            const res = await axios.get(`/api/bill-of-entries/export/pdf?${buildExportParams()}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], {type: 'application/pdf'});
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Export_data_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Export PDF failed:', err);
            toast.error('Failed to export PDF');
        }
    };

    return {
        entries,
        expanded,
        setExpanded,
        loading,
        newEntry,
        allExpanded,
        hasMore,
        selectedIds: [],
        sortField,
        sortOrder,
        searchQuery,
        filters,
        loadMoreRef,
        sortOptions,
        setSortField,
        setSortOrder,
        setSearchQuery,
        setPage,
        setNewEntry,
        setFilters,
        setAllExpanded,
        updateSingleEntry,
        handleReset,
        handleExportXLSX,
        handleExportPDF,
        fetchData,
        toggleSelect: () => {
        },
        toggleSelectAll: () => {
        },
        clearSelection: () => {
        },
    };
};

export default useBillOfEntryListManager;
