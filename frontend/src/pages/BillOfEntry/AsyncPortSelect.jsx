// components/AsyncPortSelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const loadOptions = async (inputValue) => {
    const res = await axios.get('/api/ports/', {
        params: {search: inputValue}
    });
    return res.data.results.map(port => ({
        label: port.name,
        value: port.id,
        data: port
    }));
};

const AsyncPortSelect = ({
                             value,
                             onChange,
                             isMulti = false,
                             placeholder = "Select Port" // ✅ default value
                         }) => {
    const toOption = (v) => ({
        label: v.name,
        value: v.id,
        data: v
    });

    const formattedValue = isMulti
        ? (value || []).map(toOption)
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
            placeholder={placeholder} // ✅ use dynamic placeholder
            getOptionLabel={(e) => e.label}
        />
    );
};

export default AsyncPortSelect;
