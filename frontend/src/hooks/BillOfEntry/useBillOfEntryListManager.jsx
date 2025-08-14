// src/hooks/BillOfEntry/useBillOfEntryListManager.js
import {useCallback, useEffect, useRef, useState} from 'react';
import {useInView} from 'react-intersection-observer';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import useUrlSync from '../useUrlSync';

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
    is_invoice: null, // null = all, true/false = filter
};

export const sortOptions = [
    {label: 'BOE Date ⬇️', value: 'bill_of_entry_date:desc'},
    {label: 'BOE Date ⬆️', value: 'bill_of_entry_date:asc'},
    {label: 'BOE Number ⬇️', value: 'bill_of_entry_number:desc'},
    {label: 'BOE Number ⬆️', value: 'bill_of_entry_number:asc'},
    {label: 'Modified On ⬇️', value: 'modified_on:desc'},
    {label: 'Modified On ⬆️', value: 'modified_on:asc'},
];

const getNextPageFromUrl = (nextUrl) => {
    if (!nextUrl) return null;
    try {
        const u = nextUrl.startsWith('http') ? new URL(nextUrl) : new URL(nextUrl, window.location.origin);
        const p = u.searchParams.get('page');
        return p ? parseInt(p, 10) : null;
    } catch {
        return null;
    }
};

const useBillOfEntryListManager = () => {
    // data
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [allExpanded, setAllExpanded] = useState(true);

    // selection
    const [selectedIds, setSelectedIds] = useState([]);

    // query state
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState(DEFAULT_SORT_FIELD);
    const [sortOrder, setSortOrder] = useState(DEFAULT_SORT_ORDER);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    // paging
    const [hasMore, setHasMore] = useState(true);
    const [nextUrl, setNextUrl] = useState(null);

    // add-new row
    const [newEntry, setNewEntry] = useState(null);

    // reset orchestration
    const [refreshKey, setRefreshKey] = useState(0);
    const [triggeredByFilter, setTriggeredByFilter] = useState(false);

    // infinite scroll
    const {ref: loadMoreRef, inView} = useInView({rootMargin: '600px 0px'});

    // keep URL in sync
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

    // request guards
    const abortRef = useRef(null);
    const seqRef = useRef(0);

    const buildParams = useCallback(() => {
        const params = {
            page,
            search: searchQuery || undefined,
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
            ...(filters.company_objs.length > 0 && {
                company__in: filters.company_objs.map((c) => c.id).join(','),
            }),
            ...(filters.exclude_company_objs.length > 0 && {
                exclude_company__in: filters.exclude_company_objs.map((c) => c.id).join(','),
            }),
            ...(filters.port_objs.length > 0 && {
                port__in: filters.port_objs.map((p) => p.id).join(','),
            }),
            ...(filters.exclude_port_objs.length > 0 && {
                exclude_port__in: filters.exclude_port_objs.map((p) => p.id).join(','),
            }),
            ...(filters.product_name && {product_name: filters.product_name}),
            ...(filters.from_date && {from_date: filters.from_date}),
            ...(filters.to_date && {to_date: filters.to_date}),
            ...(typeof filters.is_invoice === 'boolean' && {is_invoice: String(filters.is_invoice)}),
        };
        return params;
    }, [page, searchQuery, sortField, sortOrder, filters]);

    const fetchData = useCallback(
        async (append = false, pageOverride = null) => {
            if (loading && append) return;

            abortRef.current?.abort();
            const seq = ++seqRef.current;
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            try {
                const res = await axios.get('bill-of-entries/', {
                    params: pageOverride ? {...buildParams(), page: pageOverride} : buildParams(),
                    signal: controller.signal,
                });

                if (seq !== seqRef.current) return; // stale

                const data = res.data || {};
                const results = Array.isArray(data.results) ? data.results : [];

                setEntries((prev) => {
                    if (!append || pageOverride === 1) return results;
                    const combined = [...prev, ...results];
                    // dedupe by id
                    return Array.from(new Map(combined.map((e) => [e.id, e])).values());
                });

                setNextUrl(data.next || null);
                setHasMore(Boolean(data.next));
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                console.error(err);
                toast.error('Failed to fetch Bill of Entry data');
            } finally {
                if (seq === seqRef.current) setLoading(false);
            }
        },
        [buildParams, loading]
    );

    // reset when inputs change
    useEffect(() => {
        setEntries([]);
        setPage(1);
        setHasMore(true);
        setNextUrl(null);
        setTriggeredByFilter(true);
        setRefreshKey((k) => k + 1);
        setSelectedIds([]); // clear selection on new query
        return () => abortRef.current?.abort();
    }, [searchQuery, sortField, sortOrder, filters]);

    // fetch first page after reset
    useEffect(() => {
        if (triggeredByFilter) {
            fetchData(false, 1).then(() => setTriggeredByFilter(false));
        }
    }, [refreshKey, triggeredByFilter, fetchData]);

    // fetch when page increments (append mode)
    useEffect(() => {
        if (page > 1) fetchData(true, page);
    }, [page, fetchData]);

    // infinite scroll
    useEffect(() => {
        if (!inView || !hasMore || loading || triggeredByFilter) return;
        const np = getNextPageFromUrl(nextUrl) ?? page + 1;
        if (Number.isFinite(np)) setPage(np);
    }, [inView, hasMore, loading, triggeredByFilter, nextUrl, page]);

    // row refresh
    const updateSingleEntry = async (id) => {
        const targetId = typeof id === 'object' ? id?.id : id;
        if (!targetId) return;
        try {
            const {data} = await axios.get(`bill-of-entries/${targetId}/`);
            setEntries((prev) => prev.map((e) => (e.id === targetId ? data : e)));
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch entry');
        }
    };

    // selection helpers
    const toggleSelect = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleSelectAll = (ids = []) => {
        const allSelected = ids.every((id) => selectedIds.includes(id));
        setSelectedIds((prev) => (allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
    };

    const clearSelection = () => setSelectedIds([]);

    // reset button
    const handleReset = () => {
        setSearchQuery('');
        setSortField(DEFAULT_SORT_FIELD);
        setSortOrder(DEFAULT_SORT_ORDER);
        setFilters(DEFAULT_FILTERS);
        setPage(1);
        setEntries([]);
        setHasMore(true);
        setNextUrl(null);
        setSelectedIds([]);
    };

    // exports
    const buildExportParams = () => {
        const params = new URLSearchParams({
            search: searchQuery || '',
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
        });
        if (filters.company_objs.length) params.set('company__in', filters.company_objs.map((c) => c.id).join(','));
        if (filters.exclude_company_objs.length)
            params.set('exclude_company__in', filters.exclude_company_objs.map((c) => c.id).join(','));
        if (filters.port_objs.length) params.set('port__in', filters.port_objs.map((p) => p.id).join(','));
        if (filters.exclude_port_objs.length)
            params.set('exclude_port__in', filters.exclude_port_objs.map((p) => p.id).join(','));
        if (filters.product_name) params.set('product_name', filters.product_name);
        if (filters.from_date) params.set('from_date', filters.from_date);
        if (filters.to_date) params.set('to_date', filters.to_date);
        if (typeof filters.is_invoice === 'boolean') params.set('is_invoice', String(filters.is_invoice));
        return params.toString();
    };

    const handleExportXLSX = async () => {
        try {
            const res = await axios.get(`bill-of-entries/export-excel/?${buildExportParams()}`, {
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
            toast.error('Failed to Export Excel');
        }
    };

    const handleExportPDF = async () => {
        try {
            toast.info('Downloading PDF...');
            const res = await axios.get(`bill-of-entries/export/pdf/?${buildExportParams()}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], {type: 'application/pdf'});
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `BOE_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 500);
        } catch (err) {
            console.error('Export PDF failed:', err);
            toast.error('Failed to Export PDF');
        }
    };

    return {
        // data
        entries,
        expanded,
        setExpanded,
        loading,
        hasMore,
        allExpanded,
        setAllExpanded,

        // selection
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        clearSelection,

        // query state
        sortField,
        sortOrder,
        sortOptions,
        setSortField,
        setSortOrder,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        setPage,

        // add-new
        newEntry,
        setNewEntry,

        // io
        loadMoreRef,
        updateSingleEntry,
        handleReset,
        handleExportXLSX,
        handleExportPDF,
        fetchData,
    };
};

export default useBillOfEntryListManager;
