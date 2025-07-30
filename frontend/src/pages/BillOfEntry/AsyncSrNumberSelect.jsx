import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const AsyncSrNumberSelect = ({
                                 value,
                                 onChange,
                                 isMulti = false,
                                 placeholder = "Select SR Number",
                                 excludeIds = []
                             }) => {
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

    const loadOptions = async (inputValue) => {
        const res = await axios.get('/api/license-import-items/', {
            params: {search: inputValue}
        });

        return res.data.results
            .filter(item => !excludeIds.includes(item.id))
            .map(item => ({
                value: item.id,
                label: item.display_name,
                data: item
            }));
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
            getOptionLabel={(e) => e.label}
            styles={{
                control: (base) => ({
                    ...base,
                    minHeight: '32px',
                    fontSize: '0.875rem'
                }),
                menu: base => ({...base, zIndex: 9999})
            }}
        />
    );
};

export default AsyncSrNumberSelect;
