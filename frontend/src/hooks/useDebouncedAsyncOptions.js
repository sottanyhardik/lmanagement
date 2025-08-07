import {useMemo, useRef} from 'react';
import axios from '../api/axiosInstance';
import debounce from 'lodash.debounce';

/**
 * Debounced loader hook for react-select async
 * @param {string} url - API endpoint
 * @param {string} searchParam - query param (e.g. 'name')
 * @param {string} valueKey - key for option.value (e.g. 'id')
 * @param {object} additionalParams - extra query parameters
 */
export const useDebouncedAsyncOptions = (
    url,
    searchParam = 'search',
    valueKey = 'id',
    additionalParams = {}
) => {
    const cacheRef = useRef({});

    // Stable function to fetch options
    const fetchOptions = async (inputValue) => {
        const cacheKey = `${url}::${inputValue}::${JSON.stringify(additionalParams)}`;
        if (cacheRef.current[cacheKey]) {
            return cacheRef.current[cacheKey];
        }

        try {
            const params = {
                [searchParam]: inputValue,
                ...additionalParams,
            };

            const res = await axios.get(url, {params});
            const results = Array.isArray(res.data?.results) ? res.data.results : res.data;

            const options = results.map((item) => ({
                value: item[valueKey],
                label: item.display_name || item.name || String(item[valueKey]),
                data: item,
            }));

            cacheRef.current[cacheKey] = options;
            return options;
        } catch (err) {
            console.error(`[useDebouncedAsyncOptions] Error fetching ${url}`, err);
            return [];
        }
    };

    // âœ… useMemo ensures same hook order
    const debouncedFetch = useMemo(() => debounce(fetchOptions, 300), []);

    return debouncedFetch;
};