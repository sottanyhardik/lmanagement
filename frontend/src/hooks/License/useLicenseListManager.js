import {useCallback, useEffect, useState} from 'react';
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

const useLicenseListManager = (apiUrl = '/api/licenses/') => {
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
                ...(filters.exporter_objs.length > 0 && {
                    exporter__in: filters.exporter_objs.map(c => c.id).join(','),
                }),
                ...(filters.port_objs.length > 0 && {
                    port__in: filters.port_objs.map(p => p.id).join(','),
                }),
                ...(filters.from_date && {from_date: filters.from_date}),
                ...(filters.to_date && {to_date: filters.to_date}),
                ...(filters.expired_only && {expired_only: true}),
            };

            const res = await axios.get(apiUrl, {params});
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
            if (err?.response?.status === 404) {
                setHasMore(false);                 // stop infinite scroll
                if (page !== 1) setPage(1);         // reset to page 1 safely
                // Optional UX: inform user when first page also 404s
                if (page === 1) {
                    setEntries([]);                 // clear list if needed
                    toast.info('No data found for the current filters.');
                }
            } else {
                console.error(err);
                toast.error('Failed to fetch License data');
            }
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
            const {data} = await axios.get(`${apiUrl}${id}/`);
            setEntries(prev => prev.map(e => e.id === id ? data : e));
        } catch (err) {
            toast.error('Failed to fetch license entry');
            console.error(err);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = (ids) => {
        const allSelected = ids.every(id => selectedIds.includes(id));
        setSelectedIds(prev =>
            allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
        );
    };

    const clearSelection = () => setSelectedIds([]);

    const handleReset = () => {
        setSearchQuery('');
        setSortField(DEFAULT_SORT_FIELD);
        setSortOrder(DEFAULT_SORT_ORDER);
        setFilters(DEFAULT_FILTERS);
        setPage(1);
        setEntries([]);
        setHasMore(true);
        clearSelection();
    };

    const buildExportParams = () => {
        const params = new URLSearchParams({
            search: searchQuery,
            ordering: sortField && sortOrder ? `${sortOrder === 'desc' ? '-' : ''}${sortField}` : '',
            ...(filters.exporter_objs.length > 0 && {
                exporter__in: filters.exporter_objs.map(c => c.id).join(','),
            }),
            ...(filters.port_objs.length > 0 && {
                port__in: filters.port_objs.map(p => p.id).join(','),
            }),
            ...(filters.from_date && {from_date: filters.from_date}),
            ...(filters.to_date && {to_date: filters.to_date}),
            ...(filters.expired_only && {expired_only: 'true'}),
        });

        return params.toString();
    };

    const handleExportXLSX = async () => {
        try {
            const res = await axios.get(`${apiUrl}export-excel/?${buildExportParams()}`, {
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
            const res = await axios.get(`${apiUrl}export/pdf/?${buildExportParams()}`, {
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