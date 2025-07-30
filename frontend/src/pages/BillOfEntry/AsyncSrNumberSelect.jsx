// components/AsyncSrNumberSelect.jsx
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
    // Use shared debounced loader
    const loadBaseOptions = useDebouncedAsyncOptions('/api/license-import-items/', 'display_name', 'id');

    // Wrap to filter excluded IDs
    const loadOptions = async (inputValue) => {
        const options = await loadBaseOptions(inputValue);
        return options.filter(option => !excludeIds.includes(option.value));
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
