// components/AsyncPortSelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import {useDebouncedAsyncOptions} from '../../hooks/useDebouncedAsyncOptions';

const AsyncPortSelect = ({value, onChange, isMulti = false, placeholder = "Select Port"}) => {
    const loadOptions = useDebouncedAsyncOptions('/api/ports/');

    const toOption = (v) =>
        v?.id
            ? {value: v.id, label: v.name, data: v}
            : v?.value && v.label
                ? {value: v.value, label: v.label, data: v.data || {id: v.value, name: v.label}}
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
                menu: base => ({...base, zIndex: 9999})
            }}
        />
    );
};

export default AsyncPortSelect;
