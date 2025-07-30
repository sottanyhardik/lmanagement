// hooks/useDebouncedAsyncOptions.js
import {useMemo} from 'react';
import axios from '../api/axiosInstance';
import debounce from 'lodash.debounce';

export const useDebouncedAsyncOptions = (endpoint, labelKey = 'name', valueKey = 'id') => {
    const cache = {};

    const loadOptions = async (inputValue) => {
        if (cache[inputValue]) return cache[inputValue];

        const res = await axios.get(endpoint, {params: {search: inputValue}});
        const options = res.data.results.map(item => ({
            label: item[labelKey],
            value: item[valueKey],
            data: item,
        }));
        cache[inputValue] = options;
        return options;
    };

    const debouncedLoadOptions = useMemo(() => debounce(loadOptions, 300), []);

    return debouncedLoadOptions;
};
