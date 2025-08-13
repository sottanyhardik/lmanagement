// src/hooks/Allotment/useAllotmentListManager.js
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import axios from '../../api/axiosInstance';
import {toast} from 'react-toastify';

const DEFAULT_SORT = {field: 'estimated_arrival_date', order: 'desc'};

const initialFilters = {
    company: null,
    port: null,
    related_company: null,
    invoice: '',
    item_name: '',
    date_from: '',
    date_to: '',
    has_balance: null,     // yes / no / null
    license_number: '',
    hs_code: '',
    exporter: null,
    include_assigned: false, // server default excludes BOE-assigned
};

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

const useAllotmentListManager = () => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [next, setNext] = useState(null);

    const [expanded, setExpanded] = useState({});
    const [allExpanded, setAllExpanded] = useState(false);

    const [sortField, setSortField] = useState(DEFAULT_SORT.field);
    const [sortOrder, setSortOrder] = useState(DEFAULT_SORT.order);
    const [searchQuery, setSearchQuery] = useState('');

    const [filters, setFilters] = useState(initialFilters);

    const loadMoreRef = useRef(null);

    // request control to avoid races
    const abortRef = useRef(null);
    const reqSeqRef = useRef(0);

    const sortOptions = useMemo(
        () => [
            {value: 'estimated_arrival_date', label: 'Estimated Arrival'},
            {value: 'item_name', label: 'Item Name'},
            {value: 'invoice', label: 'Invoice'},
            {value: 'required_quantity', label: 'Required Qty'},
            {value: 'total_allotted_qty', label: 'Allotted Qty (sum)'},
            {value: 'balanced_qty', label: 'Balanced Qty'},
            {value: 'total_allotted_value_fc', label: 'Total CIF FC'},
            {value: 'total_allotted_value_inr', label: 'Total CIF INR'},
        ],
        []
    );

    const buildParams = useCallback(
        (pageOverride = 1) => {
            const params = {
                page: pageOverride,
                search: searchQuery || undefined,
                ordering: `${sortOrder === 'desc' ? '-' : ''}${sortField}`,
                // Server defaults: bill_of_entry__isnull=True AND type!='AR'
            };

            if (filters.include_assigned) params.has_boe = 'true';

            if (filters.company?.id) params.company = filters.company.id;
            if (filters.port?.id) params.port = filters.port.id;
            if (filters.related_company?.id) params.related_company = filters.related_company.id;
            if (filters.invoice) params.invoice = filters.invoice;
            if (filters.item_name) params.item_name = filters.item_name;
            if (filters.date_from) params.date_from = filters.date_from;
            if (filters.date_to) params.date_to = filters.date_to;
            if (filters.license_number) params.license_number = filters.license_number;
            if (filters.hs_code) params.hs_code = filters.hs_code;
            if (filters.exporter?.id) params.exporter = filters.exporter.id;
            if (filters.has_balance !== null && filters.has_balance !== undefined) {
                params.has_balance = String(filters.has_balance);
            }

            return params;
        },
        [filters, searchQuery, sortField, sortOrder]
    );

    const fetchData = useCallback(
        async (pageOverride = 1, append = false) => {
            // cancel previous request (if any)
            abortRef.current?.abort();
            const seq = ++reqSeqRef.current;
            const ctrl = new AbortController();
            abortRef.current = ctrl;

            setLoading(true);
            try {
                // ✅ no /api/ prefix (axiosInstance has baseURL `/api/`)
                const res = await axios.get('allotments/', {
                    params: buildParams(pageOverride),
                    signal: ctrl.signal,
                });
                if (seq !== reqSeqRef.current) return; // stale response

                const data = res.data || {};
                const results = Array.isArray(data.results) ? data.results : [];
                setEntries((prev) => (append ? [...prev, ...results] : results));
                setNext(data.next || null);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                console.error(err);
                toast.error('Failed to load allotments');
            } finally {
                if (seq === reqSeqRef.current) setLoading(false);
            }
        },
        [buildParams]
    );

    // Initial load & whenever inputs change
    useEffect(() => {
        setPage(1);
        setNext(null);
        fetchData(1, false);
        // cleanup pending on unmount
        return () => abortRef.current?.abort();
    }, [sortField, sortOrder, searchQuery, filters, fetchData]);

    // Infinite scroll
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;

        const obs = new IntersectionObserver(
            (entriesObs) => {
                const isInView = entriesObs[0]?.isIntersecting;
                if (!isInView || !next || loading) return;
                const nextPage = getNextPageFromUrl(next);
                if (nextPage && Number.isFinite(nextPage)) {
                    setPage(nextPage);
                    fetchData(nextPage, true);
                }
            },
            {root: null, rootMargin: '800px 0px 0px 0px', threshold: 0} // prefetch earlier
        );

        obs.observe(el);
        return () => obs.disconnect();
    }, [loadMoreRef, next, loading, fetchData]);

    const handleReset = useCallback(() => {
        setFilters(initialFilters);
        setSearchQuery('');
        setSortField(DEFAULT_SORT.field);
        setSortOrder(DEFAULT_SORT.order);
        setExpanded({});
        setAllExpanded(false);
    }, []);

    const updateSingleEntry = useCallback(
        async (id) => {
            try {
                const res = await axios.get(`allotments/${id}/`);
                setEntries((prev) => prev.map((e) => (e.id === id ? res.data : e)));
            } catch (err) {
                // If not found (deleted), refresh list
                fetchData(page, false);
            }
        },
        [fetchData, page]
    );

    return {
        entries,
        loading,
        next,
        page,
        setPage,
        loadMoreRef,

        expanded,
        setExpanded,
        allExpanded,
        setAllExpanded,

        sortOptions,
        sortField,
        sortOrder,
        setSortField,
        setSortOrder,

        searchQuery,
        setSearchQuery,

        filters,
        setFilters,
        handleReset,

        updateSingleEntry,
        fetchData,
    };
};

export default useAllotmentListManager;
