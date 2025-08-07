// src/constants/boeConfig.js
export const DEFAULT_FILTERS = {
    company_objs: [],
    exclude_company_objs: [],
    port_objs: [],
    exclude_port_objs: [],
    product_name: '',
    from_date: '',
    to_date: '',
    is_invoice: false,
};

export const DEFAULT_SORT_FIELD = 'bill_of_entry_date';
export const DEFAULT_SORT_ORDER = 'desc';

export const sortOptions = [
    {label: 'BOE Date ⬇️', value: 'bill_of_entry_date:desc'},
    {label: 'BOE Date ⬆️', value: 'bill_of_entry_date:asc'},
    {label: 'BOE Number ⬇️', value: 'bill_of_entry_number:desc'},
    {label: 'BOE Number ⬆️', value: 'bill_of_entry_number:asc'},
    {label: 'Modified On ⬇️', value: 'modified_on:desc'},
    {label: 'Modified On ⬆️', value: 'modified_on:asc'},
];
