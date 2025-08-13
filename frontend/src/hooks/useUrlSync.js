// hooks/useUrlSync.js
import {useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';

/** Safe parser: "field:order" → { field, order } with sane defaults */
function parseSort(input, fallback = 'modified_on:desc') {
    const raw = (input || fallback || '').toString();
    const [field = '', orderRaw = 'desc'] = raw.split(':');
    const order = orderRaw === 'asc' ? 'asc' : 'desc';
    return {field, order};
}

/**
 * Sync list state <-> URL query params.
 *
 * Params in URL:
 *   ?page=1&search=...&sort=field:asc|desc
 *
 * Options:
 *   - defaultSort: default "field:order" (used on first load if URL has none)
 *   - omitDefaults: if true, hides page=1 & default sort from URL (cleaner links)
 *   - replace: if true, uses history.replace instead of push on URL updates
 *   - preserveOthers: if true, keep unrelated query params intact when writing
 */
export default function useUrlSync({
                                       page,
                                       setPage,
                                       search,
                                       setSearch,
                                       sortField,
                                       sortOrder,
                                       setSortField,
                                       setSortOrder,
                                       defaultSort = 'modified_on:desc',
                                       omitDefaults = true,
                                       replace = true,
                                       preserveOthers = false,
                                   }) {
    const [searchParams, setSearchParams] = useSearchParams();

    // 1) On mount: read URL -> state (one time)
    useEffect(() => {
        const urlPage = Number.parseInt(searchParams.get('page') || '1', 10);
        const urlSearch = searchParams.get('search') || '';
        const urlSort = searchParams.get('sort') || defaultSort;

        const {field, order} = parseSort(urlSort, defaultSort);

        setPage?.(Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1);
        setSearch?.(urlSearch);
        setSortField?.(field);
        setSortOrder?.(order);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // deliberately only on mount

    // 2) When state changes: write state -> URL (only if different)
    useEffect(() => {
        // Build next params from state
        const params = preserveOthers ? new URLSearchParams(searchParams) : new URLSearchParams();

        // page
        if (!(omitDefaults && (page == null || page === 1))) {
            params.set('page', String(page || 1));
        } else {
            params.delete('page');
        }

        // search
        if (search) params.set('search', search);
        else params.delete('search');

        // sort
        const currentSort = sortField && sortOrder ? `${sortField}:${sortOrder}` : '';
        const isDefaultSort = currentSort === defaultSort;
        if (currentSort && !(omitDefaults && isDefaultSort)) {
            params.set('sort', currentSort);
        } else {
            params.delete('sort');
        }

        // Only update if changed (avoids churn)
        const next = params.toString();
        const prev = searchParams.toString();
        if (next !== prev) setSearchParams(params, {replace});
    }, [
        page,
        search,
        sortField,
        sortOrder,
        defaultSort,
        omitDefaults,
        replace,
        preserveOthers,
        searchParams,
        setSearchParams,
    ]);
}
