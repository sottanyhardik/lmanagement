import React from 'react';
import AsyncSelect from 'react-select/async';
import {useDebouncedAsyncOptions} from '../../hooks/useDebouncedAsyncOptions';

const AsyncSrNumberSelect = ({
                                 value,
                                 onChange,
                                 isMulti = false,
                                 placeholder = "Select SR Number",
                                 excludeIds = [],
                             }) => {
    const baseLoader = useDebouncedAsyncOptions('/api/license-import-items/', 'display_name', 'id');

    const loadOptions = async (inputValue) => {
        const options = await baseLoader(inputValue);
        if (!Array.isArray(options)) return [];

        // Print raw values
        const values = options.map(o => o.value);
        const seen = new Set();
        const duplicates = values.filter(val => {
            if (seen.has(val)) return true;
            seen.add(val);
            return false;
        });
        if (duplicates.length > 0) {
            console.warn("❌ Duplicate keys detected in options:", duplicates);
        }

        // Apply excludeIds and deduplication
        const filtered = options
            .filter(option => !excludeIds.includes(option.value))
            .filter((opt, index, self) =>
                index === self.findIndex(o => o.value === opt.value)
            );

        return filtered;
    };


    const toOption = (v) =>
        v?.id
            ? {value: v.id, label: v.display_name, data: v}
            : v?.value && v.label
                ? {value: v.value, label: v.label, data: v.data || {id: v.value, display_name: v.label}}
                : null;

    const formattedValue = isMulti
        ? (value || []).map(toOption).filter(Boolean)
        : value ? toOption(value) : null;

    const handleChange = (selected) => {
        if (isMulti) {
            onChange((selected || []).map(s => s.data));
        } else {
            onChange(selected?.data || null);
        }
    };

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            isMulti={isMulti}
            value={formattedValue}
            onChange={handleChange}
            isClearable
            placeholder={placeholder}
            styles={{
                control: base => ({...base, minHeight: '32px', fontSize: '0.875rem'}),
                menu: base => ({...base, zIndex: 9999}),
            }}
        />
    );
};

export default AsyncSrNumberSelect;
