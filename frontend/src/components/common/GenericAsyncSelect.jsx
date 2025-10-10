// src/components/common/GenericAsyncSelect.jsx
import React, {useMemo} from 'react';
import AsyncSelect from 'react-select/async';
import {useCachedAsyncOptions} from '../../hooks/useCachedAsyncOptions.js';

/**
 * Generic AsyncSelect with caching + debouncing + axiosInstance.
 * It normalizes incoming value(s) and returns `data` objects on change,
 * so your forms receive the original server payload.
 */
export default function GenericAsyncSelect({
                                               endpoint,
                                               toOption,
                                               extractItems,
                                               extraParams,
                                               searchParam = 'search',
                                               minChars = 2,
                                               debounceMs = 300,
                                               ttl,                   // optional override
                                               dedupe = true,
                                               defaultOptions = false,
                                               isMulti = false,
                                               placeholder,
                                               value,
                                               onChange,
                                               // react-select passthrough
                                               ...props
                                           }) {
    const loadOptions = useCachedAsyncOptions({
        endpoint,
        toOption,
        extractItems,
        extraParams,
        searchParam,
        minChars,
        debounceMs,
        ttl,
        dedupe,
        defaultOptions,
    });

    const normalize = (v) => {
        if (!v) return null;
        // Already option-like
        if (typeof v === 'object' && 'value' in v && 'label' in v) {
            if (!('data' in v) && v.value != null) {
                // best-effort data when only {value,label} given
                return {...v, data: {id: v.value, name: v.label}};
            }
            return v;
        }
        // Raw server object (what we want to persist)
        return toOption(v);
    };

    const formattedValue = useMemo(() => {
        if (isMulti) return (Array.isArray(value) ? value : []).map(normalize).filter(Boolean);
        return normalize(value);
    }, [value, isMulti]);

    const handleChange = (selected) => {
        if (isMulti) {
            onChange?.((selected || []).map(s => s?.data ?? null).filter(Boolean));
        } else {
            onChange?.(selected ? (selected.data ?? null) : null);
        }
    };

    return (
        <AsyncSelect
            classNamePrefix="react-select"
            className="underline-select"
            cacheOptions
            defaultOptions={defaultOptions}
            loadOptions={loadOptions}
            isMulti={isMulti}
            value={formattedValue}
            onChange={handleChange}
            isClearable
            placeholder={placeholder}
            getOptionLabel={(opt) => opt.label}
            getOptionValue={(opt) => String(opt.value)}
            // nicer inside modals:
            menuPortalTarget={document.body}
            styles={{
                menuPortal: (base) => ({...base, zIndex: 9999}),
                control: (base) => ({...base, minHeight: 32, fontSize: '0.875rem'}),
            }}
            maxMenuHeight={280}
            {...props}
        />
    );
}
