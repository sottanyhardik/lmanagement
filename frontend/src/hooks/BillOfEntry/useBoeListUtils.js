// src/hooks/useBoeListUtils.js
import {DEFAULT_FILTERS, DEFAULT_SORT_FIELD, DEFAULT_SORT_ORDER} from '../../constants/boeConfig';

export const useBoeListUtils = ({
                                    setSearchQuery,
                                    setSortField,
                                    setSortOrder,
                                    setFilters,
                                    setPage,
                                    clearSelection,
                                    setEntries,
                                    setHasMore
                                }) => {
    const handleReset = () => {
        setSearchQuery('');
        setSortField(DEFAULT_SORT_FIELD);
        setSortOrder(DEFAULT_SORT_ORDER);
        setFilters(DEFAULT_FILTERS);
        setPage(1);
        clearSelection();
        setEntries([]);
        setHasMore(true);
    };

    const buildExportParams = (searchQuery, sortField, sortOrder, filters) => {
        const params = new URLSearchParams({
            search: searchQuery,
            ordering: sortOrder === 'desc' ? `-${sortField}` : sortField,
        });

        const mapArrayFilters = {
            company_objs: 'company__in',
            exclude_company_objs: 'exclude_company__in',
            port_objs: 'port__in',
            exclude_port_objs: 'exclude_port__in'
        };

        for (const [key, paramKey] of Object.entries(mapArrayFilters)) {
            if (filters[key]?.length > 0) {
                params.append(paramKey, filters[key].map(obj => obj.id).join(','));
            }
        }

        if (filters.product_name) params.append('product_name', filters.product_name);
        if (filters.from_date) params.append('from_date', filters.from_date);
        if (filters.to_date) params.append('to_date', filters.to_date);
        if (typeof filters.is_invoice === 'boolean') {
            params.append('is_invoice', filters.is_invoice.toString());
        }

        return params.toString();
    };

    return {handleReset, buildExportParams};
};
