// src/hooks/License/useLicenseListManager.js
import createListManager from "../createListManager";

export const DEFAULT_FILTERS = {
    exporter_objs: [],
    port_objs: [],
    license_number: "",
    from_date: "",
    to_date: "",
    // optional balance filter could live here if your API supports it
};

export const sortOptions = [
    {label: "License Date ⬇️", value: "license_date:desc"},
    {label: "License Date ⬆️", value: "license_date:asc"},
    {label: "Modified On ⬇️", value: "modified_on:desc"},
    {label: "Modified On ⬆️", value: "modified_on:asc"},
];

const buildParams = ({page, searchQuery, sortField, sortOrder, filters}) => {
    const params = {
        page,
        search: searchQuery || undefined,
        ordering: sortField && sortOrder ? `${sortOrder === "desc" ? "-" : ""}${sortField}` : "",
    };
    if (filters.exporter_objs?.length) params.exporter__in = filters.exporter_objs.map((x) => x.id).join(",");
    if (filters.port_objs?.length) params.port__in = filters.port_objs.map((p) => p.id).join(",");
    if (filters.license_number) params.license_number = filters.license_number;
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    return params;
};

const useLicenseListManager = createListManager({
    resource: "licenses/",
    buildParams,
    defaultFilters: DEFAULT_FILTERS,
    defaultSortField: "license_date",
    defaultSortOrder: "desc",
    sortOptions,
    exporters: {
        excel: "licenses/export-excel/",
        pdf: "licenses/export/pdf/",
        filenameExcel: () => "licenses.xlsx",
        filenamePdf: () => `licenses_${new Date().toISOString().slice(0, 10)}.pdf`,
    },
});

export default useLicenseListManager;
