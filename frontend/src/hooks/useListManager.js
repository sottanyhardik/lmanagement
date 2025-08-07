// src/hooks/useListManager.js
import {useCallback, useEffect, useState} from 'react';
import {useInView} from 'react-intersection-observer';
import useUrlSync from '../hooks/useUrlSync';
import {toast} from 'react-toastify';
import axios from '../api/axiosInstance';

export const useListManager = ({
                                   endpoint,
                                   defaultFilters = {},
                                   defaultSortField = 'id',
                                   defaultSortOrder = 'desc',
                                   queryBuilder = null
                               }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState(defaultSortField);
    const [sortOrder, setSortOrder] = useState(defaultSortOrder);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [triggeredByFilter, setTriggeredByFilter] = useState(false);
    const [filters, setFilters] = useState(defaultFilters);
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
            let params = {
                page,
                search: searchQuery,
                ordering: sortOrder === 'desc' ? `-${sortField}` : sortField,
            };

            // Allow customization of query construction
            if (queryBuilder) {
                params = {
                    ...params,
                    ...queryBuilder(filters),
                };
            }

            const res = await axios.get(endpoint, {params});
            const newEntries = res.data.results;
            const hasNextPage = !!res.data.next;

            setEntries(prev => {
                if (page === 1) return newEntries;
                const combined = [...prev, ...newEntries];
                const unique = Array.from(new Map(combined.map(e => [e.id, e])).values());
                return unique;
            });
            setHasMore(hasNextPage);
        } catch (err) {
            toast.error('Failed to fetch list');
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

    const handleReset = () => {
        setSearchQuery('');
        setSortField(defaultSortField);
        setSortOrder(defaultSortOrder);
        setFilters(defaultFilters);
        setPage(1);
        setEntries([]);
        setHasMore(true);
    };

    return {
        entries,
        setEntries,
        filters,
        setFilters,
        searchQuery,
        setSearchQuery,
        sortField,
        setSortField,
        sortOrder,
        setSortOrder,
        page,
        setPage,
        loading,
        hasMore,
        loadMoreRef,
        handleReset,
        refresh: () => setRefreshKey(prev => prev + 1)
    };
};
