// src/hooks/License/useLicenseListManager.js
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useInView} from 'react-intersection-observer';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';
import useUrlSync from './../useUrlSync';

const DEFAULT_SORT_FIELD = 'license_date';
const DEFAULT_SORT_ORDER = 'desc';

const DEFAULT_FILTERS = {
    exporter_objs: [],
    port_objs: [],
    from_date: '',
    to_date: '',
    expired_only: false,
};

export const sortOptions = [
    {label: 'License No ⬇️', value: 'license_number:desc'},
    {label: 'License No ⬆️', value: 'license_number:asc'},
    {label: 'License Date ⬇️', value: 'license_date:desc'},
    {label: 'License Date ⬆️', value: 'license_date:asc'},
    {label: 'Expiry Date ⬇️', value: 'license_expiry_date:desc'},
    {label: 'Expiry Date ⬆️', value: 'license_expiry_date:asc'},
];

const ensureSlash = (s) => (s.endsWith('/') ? s : `${s}/`);
const nextPageFromUrl = (u) => {
    if (!u) return null;
    try {
        const url = u.startsWith('http') ? new URL(u) : new URL(u, window.location.origin);
        const p = url.searchParams.get('page');
        return p ? parseInt(p, 10) : null;
    } catch {
        return null;
    }
};

const useLicenseListManager = (apiUrl = 'licenses/') => {
    const base = useMemo(() => ensureSlash(apiUrl || 'licenses/'), [apiUrl]);

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
    const [selectedIds, setSelectedIds] = useState([]);
    const [nextUrl, setNextUrl] = useState(null);

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

    // request race guards
    const abortRef = useRef(null);
    const seqRef = useRef(0);

    const buildParams = useCallback(() => {
        const params = {
            page,
            search: searchQuery || undefined,
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
            ...(filters.exporter_objs.length > 0 && {
                exporter__in: filters.exporter_objs.map((c) => c.id).join(','),
            }),
            ...(filters.port_objs.length > 0 && {
                port__in: filters.port_objs.map((p) => p.id).join(','),
            }),
            ...(filters.from_date && {from_date: filters.from_date}),
            ...(filters.to_date && {to_date: filters.to_date}),
            ...(filters.expired_only && {expired_only: true}),
        };
        return params;
    }, [page, searchQuery, sortField, sortOrder, filters]);

    const fetchData = useCallback(
        async (append = false, pageOverride = null) => {
            if (loading && append) return; // avoid double fetch while scrolling

            abortRef.current?.abort();
            const seq = ++seqRef.current;
            const ctrl = new AbortController();
            abortRef.current = ctrl;

            setLoading(true);
            try {
                const res = await axios.get(base, {
                    params: pageOverride ? {...buildParams(), page: pageOverride} : buildParams(),
                    signal: ctrl.signal,
                });

                if (seq !== seqRef.current) return; // stale response

                const data = res.data || {};
                const results = Array.isArray(data.results) ? data.results : [];
                setEntries((prev) => {
                    if (!append || pageOverride === 1) return results;
                    const combined = [...prev, ...results];
                    return Array.from(new Map(combined.map((e) => [e.id, e])).values());
                });
                setHasMore(Boolean(data.next));
                setNextUrl(data.next || null);
            } catch (err) {
                if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
                if (err?.response?.status === 404) {
                    setHasMore(false);
                    if (page !== 1) setPage(1);
                    if (page === 1) {
                        setEntries([]);
                        toast.info('No data found for the current filters.');
                    }
                } else {
                    console.error(err);
                    toast.error('Failed to fetch License data');
                }
            } finally {
                if (seq === seqRef.current) setLoading(false);
            }
        },
        [base, buildParams, loading, page]
    );

    // reset when query/sort/filters change
    useEffect(() => {
        setEntries([]);
        setPage(1);
        setHasMore(true);
        setNextUrl(null);
        setTriggeredByFilter(true);
        setRefreshKey((k) => k + 1);
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
        const np = nextPageFromUrl(nextUrl) ?? page + 1;
        if (Number.isFinite(np)) setPage(np);
    }, [inView, hasMore, loading, triggeredByFilter, nextUrl, page]);

    const updateSingleEntry = async (id) => {
        const targetId = typeof id === 'object' ? id?.id : id;
        if (!targetId) return;
        try {
            const {data} = await axios.get(`${base}${targetId}/`);
            setEntries((prev) => prev.map((e) => (e.id === targetId ? data : e)));
        } catch (err) {
            toast.error('Failed to fetch license entry');
            console.error(err);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    const toggleSelectAll = (ids) => {
        const allSel = ids.every((id) => selectedIds.includes(id));
        setSelectedIds((prev) => (allSel ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
    };

    const clearSelection = () => setSelectedIds([]);

    const handleReset = () => {
        setSearchQuery('');
        setSortField(DEFAULT_SORT_FIELD);
        setSortOrder(DEFAULT_SORT_ORDER);
        setFilters({...DEFAULT_FILTERS, exporter_objs: [], port_objs: []}); // fresh arrays
        setPage(1);
        setEntries([]);
        setHasMore(true);
        setNextUrl(null);
        clearSelection();
    };

    const buildExportParams = () => {
        const params = new URLSearchParams({
            search: searchQuery || '',
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
        });

        if (filters.exporter_objs.length) {
            params.set('exporter__in', filters.exporter_objs.map((c) => c.id).join(','));
        }
        if (filters.port_objs.length) {
            params.set('port__in', filters.port_objs.map((p) => p.id).join(','));
        }
        if (filters.from_date) params.set('from_date', filters.from_date);
        if (filters.to_date) params.set('to_date', filters.to_date);
        if (filters.expired_only) params.set('expired_only', 'true');

        return params.toString();
    };

    const handleExportXLSX = async () => {
        try {
            const res = await axios.get(`${base}export-excel/?${buildExportParams()}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'licenses_export.xlsx';
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
            const res = await axios.get(`${base}export/pdf/?${buildExportParams()}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], {type: 'application/pdf'});
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Licenses_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.pdf`;
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
        setNewEntry,
        allExpanded,
        setAllExpanded,
        hasMore,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        clearSelection,
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
        loadMoreRef,
        updateSingleEntry,
        handleReset,
        handleExportXLSX,
        handleExportPDF,
        fetchData,
    };
};

export default useLicenseListManager;
