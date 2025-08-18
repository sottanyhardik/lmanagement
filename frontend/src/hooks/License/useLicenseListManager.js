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
    license_number: '',
    from_date: '',
    to_date: '',
    balance_cmp: 'gte',   // 'gte' | 'lte'
    balance_val: '',      // string/number
};

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

// tiny debounce
const useDebounced = (value, ms = 300) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
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
    const debouncedSearch = useDebounced(searchQuery, 300);

    const [allExpanded, setAllExpanded] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [newEntry, setNewEntry] = useState(null);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [selectedIds, setSelectedIds] = useState([]);
    const [nextUrl, setNextUrl] = useState(null);
    const [firstPageLoaded, setFirstPageLoaded] = useState(false);

    const {ref: loadMoreRef, inView} = useInView({rootMargin: '400px 0px', threshold: 0});

    // URL ↔ state sync (keeps bookmarkable)
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
            search: debouncedSearch || undefined,
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
            // backend supports ids as ?,? or separate — send comma-joined
            ...(filters.exporter_objs.length > 0 && {
                exporter__in: filters.exporter_objs.map((c) => c.id).join(','),
            }),
            ...(filters.port_objs.length > 0 && {
                port__in: filters.port_objs.map((p) => p.id).join(','),
            }),
            ...(filters.license_number && {license_number: filters.license_number}),
            ...(filters.from_date && {from_date: filters.from_date}),
            ...(filters.to_date && {to_date: filters.to_date}),
        };

        // Optional: numeric balance filter (safe to send; ignored if server doesn’t support)
        if (filters.balance_val !== '' && filters.balance_val != null) {
            const val = String(filters.balance_val).trim();
            if (val !== '') {
                params.balance_cmp = filters.balance_cmp || 'gte';
                params.balance_val = val;
            }
        }

        // Default behavior: server already returns non-expired by default
        // (see your ViewSet.get_queryset). If you add a UI switch later,
        // add `is_expired` here accordingly.

        return params;
    }, [page, debouncedSearch, sortField, sortOrder, filters]);

    const fetchPage = useCallback(
        async (pageToGet, append) => {
            abortRef.current?.abort();
            const seq = ++seqRef.current;
            const ctrl = new AbortController();
            abortRef.current = ctrl;

            setLoading(true);
            try {
                const res = await axios.get(base, {
                    params: {...buildParams(), page: pageToGet},
                    signal: ctrl.signal,
                });
                if (seq !== seqRef.current) return; // stale

                const data = res.data || {};
                const results = Array.isArray(data.results) ? data.results : [];
                setEntries((prev) => {
                    if (!append || pageToGet === 1) return results;
                    // de-dupe by id
                    const combined = [...prev, ...results];
                    return Array.from(new Map(combined.map((e) => [e.id, e])).values());
                });
                setHasMore(Boolean(data.next));
                setNextUrl(data.next || null);
                if (pageToGet === 1) setFirstPageLoaded(true);
            } catch (err) {
                if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
                if (err?.response?.status === 404) {
                    setEntries([]);
                    setHasMore(false);
                    setNextUrl(null);
                } else {
                    console.error(err);
                    toast.error('Failed to fetch License data');
                }
            } finally {
                if (seq === seqRef.current) setLoading(false);
            }
        },
        [base, buildParams]
    );

    // Reset → fetch first page when search/sort/filters change (after debounce)
    useEffect(() => {
        setEntries([]);
        setPage(1);
        setHasMore(true);
        setNextUrl(null);
        setFirstPageLoaded(false);
        fetchPage(1, false);
        return () => abortRef.current?.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, sortField, sortOrder, JSON.stringify({
        exporter: filters.exporter_objs.map((x) => x.id),
        port: filters.port_objs.map((x) => x.id),
        license_number: filters.license_number,
        from_date: filters.from_date,
        to_date: filters.to_date,
        balance_cmp: filters.balance_cmp,
        balance_val: filters.balance_val,
    })]);

    // Append next pages
    useEffect(() => {
        if (page > 1) fetchPage(page, true);
    }, [page, fetchPage]);

    // Infinite scroll sentinel:
    useEffect(() => {
        // Only react to the sentinel after page 1 is in, to avoid double calls on mount.
        if (!firstPageLoaded) return;
        if (!hasMore || loading) return;
        if (!inView) return;

        const np = nextPageFromUrl(nextUrl) ?? page + 1;
        if (Number.isFinite(np)) setPage(np);
    }, [inView, hasMore, loading, nextUrl, page, firstPageLoaded]);

    const updateSingleEntry = async (id) => {
        const targetId = typeof id === 'object' ? id?.id : id;
        if (!targetId) return;
        try {
            const {data} = await axios.get(`${base}${targetId}/`);
            setEntries((prev) => prev.map((e) => (e.id === targetId ? data : e)));
        } catch (err) {
            console.error(err);
            toast.error('Failed to refresh entry');
        }
    };

    const toggleSelect = (id) =>
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

    const toggleSelectAll = (ids) => {
        const allSel = ids.every((id) => selectedIds.includes(id));
        setSelectedIds((prev) => (allSel ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
    };

    const clearSelection = () => setSelectedIds([]);

    const handleReset = () => {
        setSearchQuery('');
        setSortField(DEFAULT_SORT_FIELD);
        setSortOrder(DEFAULT_SORT_ORDER);
        setFilters({...DEFAULT_FILTERS, exporter_objs: [], port_objs: []});
        setPage(1);
        setEntries([]);
        setHasMore(true);
        setNextUrl(null);
        clearSelection();
    };

    const buildExportParams = () => {
        const params = new URLSearchParams({
            search: debouncedSearch || '',
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
        });

        if (filters.exporter_objs.length) {
            params.set('exporter__in', filters.exporter_objs.map((c) => c.id).join(','));
        }
        if (filters.port_objs.length) {
            params.set('port__in', filters.port_objs.map((p) => p.id).join(','));
        }
        if (filters.license_number) params.set('license_number', filters.license_number);
        if (filters.from_date) params.set('from_date', filters.from_date);
        if (filters.to_date) params.set('to_date', filters.to_date);
        if (filters.balance_val !== '' && filters.balance_val != null) {
            params.set('balance_cmp', filters.balance_cmp || 'gte');
            params.set('balance_val', String(filters.balance_val));
        }

        return params.toString();
    };

    const handleExportXLSX = async () => {
        try {
            const res = await axios.get(`${base}export/excel/?${buildExportParams()}`, {
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
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 500);
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
        fetchData: (append = false, p = 1) => fetchPage(p, append),
    };
};

export default useLicenseListManager;
