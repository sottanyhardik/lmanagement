// src/hooks/BillOfEntry/useBillOfEntryListManager.js
import {useCallback, useEffect, useRef, useState} from 'react';
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
    is_invoice: null, // tri-state: null=All, true/false = filter
};

export const sortOptions = [
    {label: 'BOE Date ⬇️', value: 'bill_of_entry_date:desc'},
    {label: 'BOE Date ⬆️', value: 'bill_of_entry_date:asc'},
    {label: 'BOE Number ⬇️', value: 'bill_of_entry_number:desc'},
    {label: 'BOE Number ⬆️', value: 'bill_of_entry_number:asc'},
    {label: 'Modified On ⬇️', value: 'modified_on:desc'},
    {label: 'Modified On ⬆️', value: 'modified_on:asc'},
];

function getNextPageFromUrl(nextUrl) {
    if (!nextUrl) return null;
    try {
        const u = nextUrl.startsWith('http')
            ? new URL(nextUrl)
            : new URL(nextUrl, window.location.origin);
        const p = u.searchParams.get('page');
        return p ? parseInt(p, 10) : null;
    } catch {
        return null;
    }
}

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
    const [nextUrl, setNextUrl] = useState(null);

    const {ref: loadMoreRef, inView} = useInView();

    // keep URL in sync (unchanged API)
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

    // Abort + sequencing to prevent stale updates
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
            ...(typeof filters.is_invoice === 'boolean' && {
                is_invoice: String(filters.is_invoice),
            }),
        };
        return params;
    }, [page, searchQuery, sortField, sortOrder, filters]);

    const fetchData = useCallback(
        async (append = false, pageOverride = null) => {
            if (loading && append) return; // prevent double fetch while scrolling
            // cancel any in-flight
            abortRef.current?.abort();
            const seq = ++seqRef.current;
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            try {
                // ✅ no /api prefix (axiosInstance baseURL is /api/)
                const res = await axios.get('bill-of-entries/', {
                    params: pageOverride ? {...buildParams(), page: pageOverride} : buildParams(),
                    signal: controller.signal,
                });

                if (seq !== seqRef.current) return; // stale response ignored

                const data = res.data || {};
                const results = Array.isArray(data.results) ? data.results : [];
                setEntries((prev) => {
                    if (!append || pageOverride === 1) return results;
                    // dedupe by id
                    const combined = [...prev, ...results];
                    return Array.from(new Map(combined.map((e) => [e.id, e])).values());
                });
                setNextUrl(data.next || null);
                setHasMore(Boolean(data.next));
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                toast.error('Failed to fetch BOE data');
                console.error(err);
            } finally {
                if (seq === seqRef.current) setLoading(false);
            }
        },
        [buildParams, loading]
    );

    // Reset & refetch when inputs change
    useEffect(() => {
        setEntries([]);
        setPage(1);
        setHasMore(true);
        setNextUrl(null);
        setTriggeredByFilter(true);
        setRefreshKey((k) => k + 1);
    }, [searchQuery, sortField, sortOrder, filters]);

    // Fetch page 1 after reset
    useEffect(() => {
        if (triggeredByFilter) {
            fetchData(false, 1).then(() => setTriggeredByFilter(false));
        }
        return () => abortRef.current?.abort();
    }, [refreshKey, triggeredByFilter, fetchData]);

    // Fetch when page changes (append beyond page 1)
    useEffect(() => {
        if (page > 1) fetchData(true, page);
    }, [page, fetchData]);

    // Infinite scroll: load next page when in view
    useEffect(() => {
        if (!inView || !hasMore || loading || triggeredByFilter) return;
        const nextPage = getNextPageFromUrl(nextUrl) ?? page + 1;
        if (Number.isFinite(nextPage)) setPage(nextPage);
    }, [inView, hasMore, loading, triggeredByFilter, nextUrl, page]);

    const updateSingleEntry = async (id) => {
        const targetId = typeof id === 'object' ? id?.id : id;
        if (!targetId) return;
        try {
            const {data} = await axios.get(`bill-of-entries/${targetId}/`);
            setEntries((prev) => prev.map((e) => (e.id === targetId ? data : e)));
        } catch (err) {
            toast.error('Failed to fetch entry');
            console.error(err);
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
        setNextUrl(null);
    };

    const buildExportParams = () => {
        const params = new URLSearchParams({
            search: searchQuery || '',
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
        });

        if (filters.company_objs.length)
            params.set('company__in', filters.company_objs.map((c) => c.id).join(','));
        if (filters.exclude_company_objs.length)
            params.set('exclude_company__in', filters.exclude_company_objs.map((c) => c.id).join(','));
        if (filters.port_objs.length)
            params.set('port__in', filters.port_objs.map((p) => p.id).join(','));
        if (filters.exclude_port_objs.length)
            params.set('exclude_port__in', filters.exclude_port_objs.map((p) => p.id).join(','));
        if (filters.product_name) params.set('product_name', filters.product_name);
        if (filters.from_date) params.set('from_date', filters.from_date);
        if (filters.to_date) params.set('to_date', filters.to_date);
        if (typeof filters.is_invoice === 'boolean')
            params.set('is_invoice', String(filters.is_invoice));

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
            const res = await axios.get(`bill-of-entries/export/pdf?${buildExportParams()}`, {
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
            toast.error('Failed to Export PDF');
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
