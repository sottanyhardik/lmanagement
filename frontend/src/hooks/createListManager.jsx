// src/hooks/createListManager.js
import {useCallback, useEffect, useRef, useState} from "react";
import {useInView} from "react-intersection-observer";
import axios from "../api/axiosInstance";
import {toast} from "react-toastify";
import useUrlSync from "./useUrlSync";

/**
 * Factory to build a list manager hook for any resource.
 */
export default function createListManager({
                                              resource,                 // e.g. "bill-of-entries/"
                                              buildParams,              // (state) => axios params
                                              defaultFilters,           // object
                                              defaultSortField,         // string
                                              defaultSortOrder,         // "asc" | "desc"
                                              sortOptions,              // array for UI
                                              exporters = null,         // { excel: path, pdf: path, filenameExcel?: fn, filenamePdf?: fn }
                                          }) {
    return function useGenericListManager() {
        // data
        const [entries, setEntries] = useState([]);
        const [expanded, setExpanded] = useState({});
        const [allExpanded, setAllExpanded] = useState(true);

        // selection
        const [selectedIds, setSelectedIds] = useState([]);

        // query state
        const [loading, setLoading] = useState(false);
        const [page, setPage] = useState(1);
        const [sortField, _setSortField] = useState(defaultSortField);
        const [sortOrder, _setSortOrder] = useState(defaultSortOrder);
        const [searchQuery, _setSearchQuery] = useState("");
        const [filters, _setFilters] = useState(defaultFilters);

        // paging
        const [hasMore, setHasMore] = useState(true);
        const [nextUrl, setNextUrl] = useState(null);

        // add-new row
        const [newEntry, setNewEntry] = useState(null);

        // reset orchestration
        const [refreshKey, setRefreshKey] = useState(0);
        const [triggeredByFilter, setTriggeredByFilter] = useState(false);

        // infinite scroll
        const {ref: loadMoreRef, inView} = useInView({rootMargin: "600px 0px"});

        // keep URL in sync
        useUrlSync({
            page,
            setPage,
            search: searchQuery,
            setSearch: (v) => setSearchQuery(v, {resetPage: true, clearUrlPage: true}),
            sortField,
            sortOrder,
            setSortField: (v) => setSortField(v, {resetPage: true, clearUrlPage: true}),
            setSortOrder: (v) => setSortOrder(v, {resetPage: true, clearUrlPage: true})
        });

        // request guards
        const abortRef = useRef(null);
        const seqRef = useRef(0);
        const lastRequestedPageRef = useRef(0);
        const pagingLockRef = useRef(false);

        // --- helpers to normalize page reset & URL cleanup ---
        const clearPageFromUrl = () => {
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has("page")) {
                    url.searchParams.delete("page");
                    window.history.replaceState(null, "", url.toString());
                }
            } catch {/* no-op */
            }
        };

        const setSearchQuery = (value, opts = {}) => {
            if (opts.resetPage) setPage(1);
            if (opts.clearUrlPage) clearPageFromUrl();
            _setSearchQuery(value);
        };

        const setSortField = (value, opts = {}) => {
            if (opts.resetPage) setPage(1);
            if (opts.clearUrlPage) clearPageFromUrl();
            _setSortField(value);
        };

        const setSortOrder = (value, opts = {}) => {
            if (opts.resetPage) setPage(1);
            if (opts.clearUrlPage) clearPageFromUrl();
            _setSortOrder(value);
        };

        const setFilters = (updater, opts = {resetPage: true, clearUrlPage: true}) => {
            if (opts?.resetPage) setPage(1);
            if (opts?.clearUrlPage) clearPageFromUrl();
            if (typeof updater === "function") {
                _setFilters((prev) => updater(prev));
            } else {
                _setFilters(updater);
            }
        };

        const getNextPageFromUrl = (nextUrl) => {
            if (!nextUrl) return null;
            try {
                const u = nextUrl.startsWith("http") ? new URL(nextUrl) : new URL(nextUrl, window.location.origin);
                const p = u.searchParams.get("page");
                return p ? parseInt(p, 10) : null;
            } catch {
                return null;
            }
        };

        const fetchData = useCallback(
            async (append = false, pageOverride = null) => {
                if ((loading && append) || pagingLockRef.current) return;

                const targetPage = pageOverride ?? page;
                if (append && lastRequestedPageRef.current === targetPage) return;

                pagingLockRef.current = true;
                lastRequestedPageRef.current = targetPage;

                abortRef.current?.abort();
                const seq = ++seqRef.current;
                const controller = new AbortController();
                abortRef.current = controller;

                setLoading(true);
                try {
                    const params = pageOverride
                        ? {...buildParams({page, searchQuery, sortField, sortOrder, filters}), page: pageOverride}
                        : buildParams({page, searchQuery, sortField, sortOrder, filters});

                    const res = await axios.get(resource, {params, signal: controller.signal});

                    if (seq !== seqRef.current) return; // ignore stale

                    const data = res.data || {};
                    const results = Array.isArray(data.results) ? data.results : [];

                    setEntries((prev) => {
                        if (!append || pageOverride === 1) return results;
                        const combined = [...prev, ...results];
                        return Array.from(new Map(combined.map((e) => [e.id, e])).values());
                    });

                    setNextUrl(data.next || null);
                    setHasMore(Boolean(data.next));
                } catch (err) {
                    if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
                    console.error(err);
                    toast.error("Failed to fetch data");
                } finally {
                    if (seq === seqRef.current) setLoading(false);
                    pagingLockRef.current = false;
                }
            },
            [resource, buildParams, loading, page, searchQuery, sortField, sortOrder, filters]
        );

        // reset when inputs change (search/sort/filters)
        useEffect(() => {
            // Clear page param in the URL so url-sync can’t re-apply page>1
            clearPageFromUrl();

            setEntries([]);
            setPage(1);
            setHasMore(true);
            setNextUrl(null);
            setTriggeredByFilter(true);
            setRefreshKey((k) => k + 1);
            setSelectedIds([]);
            lastRequestedPageRef.current = 0;
            pagingLockRef.current = false;
            return () => abortRef.current?.abort();
        }, [searchQuery, sortField, sortOrder, filters]);

        // fetch first page after reset
        useEffect(() => {
            if (triggeredByFilter) fetchData(false, 1).then(() => setTriggeredByFilter(false));
        }, [refreshKey, triggeredByFilter, fetchData]);

        // fetch when page increments (append mode)
        useEffect(() => {
            if (page > 1) fetchData(true, page);
        }, [page, fetchData]);

        // infinite scroll
        useEffect(() => {
            if (!inView || triggeredByFilter || loading || !hasMore || !nextUrl) return;
            const np = getNextPageFromUrl(nextUrl);
            if (!Number.isFinite(np)) return;
            if (np === page || np === lastRequestedPageRef.current) return;
            setPage(np);
        }, [inView, hasMore, loading, triggeredByFilter, nextUrl, page]);

        // row refresh
        const updateSingleEntry = async (id) => {
            const targetId = typeof id === "object" ? id?.id : id;
            if (!targetId) return;
            try {
                const {data} = await axios.get(`${resource}${targetId}/`);
                setEntries((prev) => prev.map((e) => (e.id === targetId ? data : e)));
            } catch (err) {
                console.error(err);
                toast.error("Failed to fetch entry");
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
            clearPageFromUrl();
            _setSearchQuery("");
            _setSortField(defaultSortField);
            _setSortOrder(defaultSortOrder);
            _setFilters(defaultFilters);
            setPage(1);
            setEntries([]);
            setHasMore(true);
            setNextUrl(null);
            setSelectedIds([]);
            lastRequestedPageRef.current = 0;
            pagingLockRef.current = false;
        };

        // exports
        const buildExportParams = () => {
            const params = new URLSearchParams({
                search: searchQuery || "",
                ordering: sortField && sortOrder ? `${sortOrder === "desc" ? "-" : ""}${sortField}` : "",
            });

            const extra = buildParams({page: 1, searchQuery, sortField, sortOrder, filters, forExport: true});
            Object.entries(extra || {}).forEach(([k, v]) => {
                if (k === "page" || v == null || v === "") return;
                params.set(k, String(v));
            });
            return params.toString();
        };

        const handleExportXLSX = async () => {
            if (!exporters?.excel) return;
            try {
                const res = await axios.get(`${exporters.excel}?${buildExportParams()}`, {responseType: "blob"});
                const blob = new Blob([res.data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = exporters?.filenameExcel?.() || "export.xlsx";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error("Export Excel failed:", error);
                toast.error("Failed to Export Excel");
            }
        };

        const handleExportPDF = async () => {
            if (!exporters?.pdf) return;
            try {
                toast.info("Downloading PDF...");
                const res = await axios.get(`${exporters.pdf}?${buildExportParams()}`, {responseType: "blob"});
                const blob = new Blob([res.data], {type: "application/pdf"});
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = exporters?.filenamePdf?.() || "export.pdf";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => window.URL.revokeObjectURL(url), 500);
            } catch (err) {
                console.error("Export PDF failed:", err);
                toast.error("Failed to Export PDF");
            }
        };

        return {
            // data
            entries, expanded, setExpanded, loading, hasMore, allExpanded, setAllExpanded,

            // selection
            selectedIds, toggleSelect, toggleSelectAll, clearSelection,

            // query state
            sortField, sortOrder, sortOptions,
            setSortField: (v) => setSortField(v, {resetPage: true, clearUrlPage: true}),
            setSortOrder: (v) => setSortOrder(v, {resetPage: true, clearUrlPage: true}),
            searchQuery,
            setSearchQuery: (v) => setSearchQuery(v, {resetPage: true, clearUrlPage: true}),
            filters,
            setFilters: (u, opts) => setFilters(u, {...{resetPage: true, clearUrlPage: true}, ...(opts || {})}),
            setPage,

            // add-new
            newEntry, setNewEntry,

            // io
            loadMoreRef, updateSingleEntry, handleReset, handleExportXLSX, handleExportPDF, fetchData,
        };
    };
}
