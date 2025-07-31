import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance'; // adjust path as needed

const AsyncSrNumberSelect = ({
                                 value,
                                 onChange,
                                 isMulti = false,
                                 placeholder = "Select SR Number",
                             }) => {

    const loadOptions = async (inputValue) => {
        try {
            const res = await axios.get('/api/license-import-items/', {
                params: {display_name: inputValue}
            });
            const seen = new Set();
            const options = (res.data?.results || []).filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            }).map(item => ({
                value: item.id,
                label: item.display_name,
                data: item
            }));
            return options;
        } catch (err) {
            console.error('Failed to load SR options', err);
            return [];
        }
    };

    const toOption = (v) =>
        v?.id
            ? {value: v.id, label: v.display_name, data: v}
            : v?.value && v.label
                ? {
                    value: v.value,
                    label: v.label,
                    data: v.data || {id: v.value, display_name: v.label}
                }
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
            defaultOptions={false}
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
