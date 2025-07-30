// components/AsyncAllotmentSelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import {useDebouncedAsyncOptions} from '../../hooks/useDebouncedAsyncOptions';

const AsyncAllotmentSelect = ({value, onChange, isMulti = true}) => {
    const formatLabel = (item) =>
        `${item.invoice} - ${item.item_name} - ${item.required_quantity} - ${item.company?.name}`;

    const baseLoader = useDebouncedAsyncOptions('/api/option-allotments/', 'item_name', 'id');

    const loadOptions = async (inputValue) => {
        const options = await baseLoader(inputValue);
        return options.map(o => ({
            ...o,
            label: formatLabel(o.data), // override label formatting
        }));
    };

    const toOption = (v) =>
        v?.id
            ? {value: v.id, label: formatLabel(v), data: v}
            : v?.value && v.label
                ? {value: v.value, label: v.label, data: v.data || {id: v.value}}
                : null;

    const defaultValue = isMulti
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
            value={defaultValue}
            onChange={handleChange}
            isClearable
            placeholder="Select Allotment"
            styles={{
                control: base => ({...base, minHeight: '32px', fontSize: '0.875rem'}),
                menu: base => ({...base, zIndex: 9999})
            }}
        />
    );
};

export default AsyncAllotmentSelect;
