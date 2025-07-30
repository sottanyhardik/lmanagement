import {useCallback, useRef} from 'react';
import axios from '../api/axiosInstance';
import debounce from 'lodash.debounce';

/**
 * Custom hook to create a debounced async options loader for react-select
 * @param {string} url - API endpoint
 * @param {string} searchParam - query param name to search (e.g. 'name')
 * @param {string} valueKey - field used for option.value (e.g. 'id')
 * @param {object} additionalParams - any static query parameters (optional)
 * @returns {function} debounced loader function
 */
export const useDebouncedAsyncOptions = (url, searchParam = 'search', valueKey = 'id', additionalParams = {}) => {
    const cacheRef = useRef({});

    const fetchOptions = async (inputValue) => {
        const key = `${url}::${inputValue}`;
        if (cacheRef.current[key]) {
            return cacheRef.current[key];
        }

        try {
            const params = {
                [searchParam]: inputValue,
                ...additionalParams
            };

            const res = await axios.get(url, {params});
            const results = Array.isArray(res.data?.results) ? res.data.results : res.data;

            const options = results.map(item => ({
                value: item[valueKey],
                label: item.name || item.display_name || String(item[valueKey]),
                data: item
            }));

            cacheRef.current[key] = options;
            return options;
        } catch (err) {
            console.error(`[useDebouncedAsyncOptions] Failed to fetch options from ${url}`, err);
            return [];
        }
    };

    const debouncedLoader = useCallback(debounce(fetchOptions, 300), [url, searchParam, valueKey]);

    return debouncedLoader;
};
