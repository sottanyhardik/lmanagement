// src/hooks/Allotment/useAllotmentListManager.js
import createListManager from "../createListManager";

export const DEFAULT_FILTERS = {
    // NEW: four multi-selects
    company_objs: [],
    exclude_company_objs: [],
    port_objs: [],
    exclude_port_objs: [],

    // existing singles
    related_company: null,
    exporter: null,
    invoice: "",
    item_name: "",
    license_number: "",
    hs_code: "",
    date_from: "",
    date_to: "",
    has_balance: null,
    include_assigned: null,
};

export const sortOptions = [
    {label: "Created ⬇️", value: "created_on:desc"},
    {label: "Created ⬆️", value: "created_on:asc"},
    {label: "Modified ⬇️", value: "modified_on:desc"},
    {label: "Modified ⬆️", value: "modified_on:asc"},
];

const buildParams = ({page, searchQuery, sortField, sortOrder, filters}) => {
    const params = {
        page,
        search: searchQuery || undefined,
        ordering: sortField && sortOrder ? `${sortOrder === "desc" ? "-" : ""}${sortField}` : "",
    };

    // NEW: include/exclude as CSV id lists
    if (filters.company_objs?.length) {
        params.company = filters.company_objs.map((c) => c.id).join(",");
    }
    if (filters.exclude_company_objs?.length) {
        params.exclude_company = filters.exclude_company_objs.map((c) => c.id).join(",");
    }
    if (filters.port_objs?.length) {
        params.port = filters.port_objs.map((p) => p.id).join(",");
    }
    if (filters.exclude_port_objs?.length) {
        params.exclude_port = filters.exclude_port_objs.map((p) => p.id).join(",");
    }

    // existing singles
    if (filters.related_company?.id) params.related_company = filters.related_company.id;
    if (filters.exporter?.id) params.exporter = filters.exporter.id;

    if (filters.invoice) params.invoice = filters.invoice;
    if (filters.item_name) params.item_name = filters.item_name;
    if (filters.license_number) params.license_number = filters.license_number;
    if (filters.hs_code) params.hs_code = filters.hs_code;

    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;

    if (typeof filters.has_balance === "boolean") params.has_balance = String(filters.has_balance);
    if (typeof filters.include_assigned === "boolean") params.include_assigned = String(filters.include_assigned);

    return params;
};

const useAllotmentListManager = createListManager({
    resource: "allotments/",
    buildParams,
    defaultFilters: DEFAULT_FILTERS,
    defaultSortField: "created_on",
    defaultSortOrder: "desc",
    sortOptions,
    exporters: null, // add later if you expose exports
});

export default useAllotmentListManager;
