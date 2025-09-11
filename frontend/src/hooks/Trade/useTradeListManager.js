import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import axios from "../../api/axiosInstance";

const defaultSortOptions = [
    {value: "-created_on", label: "Newest"},
    {value: "created_on", label: "Oldest"},
    {value: "-invoice_date", label: "Invoice Date ↓"},
    {value: "invoice_date", label: "Invoice Date ↑"},
    {value: "-total_amount", label: "Total Amount ↓"},
    {value: "total_amount", label: "Total Amount ↑"},
    {value: "-paid_total", label: "Settled Amount ↓"},
    {value: "paid_total", label: "Settled Amount ↑"},
    // 🔁 use backend alias
    {value: "-due_amount_calc", label: "Due Amount ↓"},
    {value: "due_amount_calc", label: "Due Amount ↑"},
];

export default function useTradeListManager(opts = {}) {
    const {initialFilters, endpoint = "trades/"} = opts;

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState({});
    const [allExpanded, setAllExpanded] = useState(false);
    const [newEntry, setNewEntry] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);

    const [sortField, setSortField] = useState("-created_on");
    const [sortOrder, setSortOrder] = useState("desc");
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState(() => initialFilters || {});

    const loadMoreRef = useRef(null);

    useEffect(() => {
        if (initialFilters && Object.keys(initialFilters).length) {
            setFilters((prev) => ({...prev, ...initialFilters}));
            setPage(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(initialFilters)]);

    const buildParams = useCallback(() => {
        const params = {page, ordering: sortField};
        if (searchQuery) params.search = searchQuery;

        if (filters.direction) params.direction = filters.direction;
        if (filters.invoice_number) params.invoice_number = filters.invoice_number;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        if (filters.boe_obj) params.boe = filters.boe_obj.id ?? filters.boe_obj.value;
        if (Array.isArray(filters.company_objs) && filters.company_objs.length === 1) {
            params.company = filters.company_objs[0].id ?? filters.company_objs[0].value;
        }
        if (typeof filters.has_due === "boolean") params.has_due = filters.has_due;

        return params;
    }, [page, sortField, searchQuery, filters]);

    const fetchData = useCallback(
        async (append = true, resetToPage = null) => {
            setLoading(true);
            try {
                if (resetToPage != null) setPage(resetToPage);
                const params = buildParams();
                const {data} = await axios.get(endpoint, {params});
                const results = Array.isArray(data?.results)
                    ? data.results
                    : Array.isArray(data)
                        ? data
                        : [];
                setHasMore(Boolean(data?.next));
                setEntries((prev) => (append ? [...prev, ...results] : results));
            } finally {
                setLoading(false);
            }
        },
        [buildParams, endpoint]
    );

    useEffect(() => {
        fetchData(page !== 1, page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        page,
        sortField,
        searchQuery,
        filters.direction,
        filters.invoice_number,
        filters.date_from,
        filters.date_to,
        filters.has_due,
        JSON.stringify(filters.boe_obj),
        JSON.stringify(filters.company_objs),
    ]);

    const updateSingleEntry = useCallback(
        async (id) => {
            const {data} = await axios.get(`${endpoint}${id}/`);
            setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
        },
        [endpoint]
    );

    const handleReset = useCallback(() => {
        setFilters(initialFilters || {});
        setSearchQuery("");
        setSortField("-created_on");
        setPage(1);
        setEntries([]);
        fetchData(false, 1);
    }, [fetchData, initialFilters]);

    const toggleSelect = useCallback((id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);
    const toggleSelectAll = useCallback((ids) => setSelectedIds(ids || []), []);

    const sortOptions = useMemo(() => defaultSortOptions, []);

    return {
        entries,
        loading,
        hasMore,
        expanded,
        setExpanded,
        allExpanded,
        setAllExpanded,
        newEntry,
        setNewEntry,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
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
        fetchData,
        handleReset,
    };
}
