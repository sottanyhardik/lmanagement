// src/constants/boeConfig.js

// Factory so every consumer gets a fresh object (no accidental cross-mutation)
export const createDefaultFilters = () => ({
    company_objs: [],
    exclude_company_objs: [],
    port_objs: [],
    exclude_port_objs: [],
    product_name: '',
    from_date: null,        // use null over '' for cleaner checks
    to_date: null,
    is_invoice: null,       // tri-state: null = All, true = Yes, false = No (pairs with <YesNoRadio>)
});

// Still export a frozen snapshot if you like referencing a constant
export const DEFAULT_FILTERS = Object.freeze(createDefaultFilters());

export const DEFAULT_SORT_FIELD = 'bill_of_entry_date';
export const DEFAULT_SORT_ORDER = 'desc';

// Keep labels & keys in one place, generate options to avoid typos
const SORT_FIELDS = [
    {key: 'bill_of_entry_date', label: 'BOE Date'},
    {key: 'bill_of_entry_number', label: 'BOE Number'},
    {key: 'modified_on', label: 'Modified On'},
];

export const sortOptions = SORT_FIELDS.flatMap(({key, label}) => ([
    {label: `${label} ⬇️`, value: `${key}:desc`},
    {label: `${label} ⬆️`, value: `${key}:asc`},
]));

// 'field:order' → { field, order }
export const parseSort = (val) => {
    const [field, order] = String(val || '').split(':');
    return {
        field: field || DEFAULT_SORT_FIELD,
        order: order === 'asc' ? 'asc' : 'desc',
    };
};

/**
 * Convert filters + sort to API params (DRF-friendly)
 * - Arrays of objects → CSV of ids/values
 * - Skips empty values
 * - Ordering uses DRF style: 'field' (asc) or '-field' (desc)
 */
export const toQueryParams = (filters = {}, sortField, sortOrder) => {
    const f = {...createDefaultFilters(), ...filters};
    const params = {};

    const arrToCsv = (arr) =>
        (arr || [])
            .map((x) => (typeof x === 'object' ? (x.id ?? x.value ?? x) : x))
            .filter((v) => v !== undefined && v !== null && v !== '')
            .join(',');

    if (f.company_objs?.length) params.company = arrToCsv(f.company_objs);
    if (f.exclude_company_objs?.length) params.exclude_company = arrToCsv(f.exclude_company_objs);
    if (f.port_objs?.length) params.port = arrToCsv(f.port_objs);
    if (f.exclude_port_objs?.length) params.exclude_port = arrToCsv(f.exclude_port_objs);

    if (f.product_name?.trim()) params.product_name = f.product_name.trim();
    if (f.from_date) params.from_date = f.from_date; // expect 'YYYY-MM-DD'
    if (f.to_date) params.to_date = f.to_date;

    if (f.is_invoice !== null && f.is_invoice !== undefined) {
        params.is_invoice = f.is_invoice; // boolean; server should accept true/false
    }

    const field = sortField || DEFAULT_SORT_FIELD;
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    params.ordering = order === 'asc' ? field : `-${field}`;

    return params;
};
