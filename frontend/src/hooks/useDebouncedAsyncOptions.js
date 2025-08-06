// hooks/useDebouncedAsyncOptions.js
import {useCallback} from 'react';
import debounce from 'lodash.debounce';
import axios from '../api/axiosInstance';

export const useDebouncedAsyncOptions = (url) => {
    return useCallback(
        debounce(async (inputValue, callback) => {
            try {
                const res = await axios.get(url, {
                    params: {
                        search: inputValue,
                        limit: 50, // Increase this limit to get more options
                    }
                });
                const options = res.data.results?.map(item => ({
                    value: item.id,
                    label: item.name,
                    data: item,
                })) || [];
                callback(options);
            } catch (err) {
                callback([]);
            }
        }, 300), // debounce delay
        []
    );
};
