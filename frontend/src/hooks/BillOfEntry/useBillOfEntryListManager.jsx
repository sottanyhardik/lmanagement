// src/hooks/BillOfEntry/useBillOfEntryListManager.js
import createListManager from "../createListManager";

const DEFAULT_FILTERS = {
    company_objs: [],
    exclude_company_objs: [],
    port_objs: [],
    exclude_port_objs: [],
    product_name: "",
    from_date: "",
    to_date: "",
    is_invoice: false, // null = all, true/false = filter
};

const sortOptions = [
    {label: "BOE Date ⬇️", value: "bill_of_entry_date:desc"},
    {label: "BOE Date ⬆️", value: "bill_of_entry_date:asc"},
    {label: "BOE Number ⬇️", value: "bill_of_entry_number:desc"},
    {label: "BOE Number ⬆️", value: "bill_of_entry_number:asc"},
    {label: "Modified On ⬇️", value: "modified_on:desc"},
    {label: "Modified On ⬆️", value: "modified_on:asc"},
];

const buildParams = ({page, searchQuery, sortField, sortOrder, filters}) => {
    const params = {
        page,
        search: searchQuery || undefined,
        ordering: sortField && sortOrder ? `${sortOrder === "desc" ? "-" : ""}${sortField}` : "",
    };
    if (filters.company_objs?.length) params.company__in = filters.company_objs.map((c) => c.id).join(",");
    if (filters.exclude_company_objs?.length) params.exclude_company__in = filters.exclude_company_objs.map((c) => c.id).join(",");
    if (filters.port_objs?.length) params.port__in = filters.port_objs.map((p) => p.id).join(",");
    if (filters.exclude_port_objs?.length) params.exclude_port__in = filters.exclude_port_objs.map((p) => p.id).join(",");
    if (filters.product_name) params.product_name = filters.product_name;
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    if (typeof filters.is_invoice === "boolean") params.is_invoice = String(filters.is_invoice);
    return params;
};

const useBillOfEntryListManager = createListManager({
    resource: "bill-of-entries/",
    buildParams,
    defaultFilters: DEFAULT_FILTERS,
    defaultSortField: "bill_of_entry_date",
    defaultSortOrder: "desc",
    sortOptions,
    exporters: {
        excel: "bill-of-entries/export-excel/",
        pdf: "bill-of-entries/export/pdf/",
        filenameExcel: () => "bill_of_entries.xlsx",
        filenamePdf: () => `BOE_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`,
    },
});

export default useBillOfEntryListManager;
export {DEFAULT_FILTERS, sortOptions};
