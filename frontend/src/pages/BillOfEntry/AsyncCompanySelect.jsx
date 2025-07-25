// components/AsyncCompanySelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const loadOptions = async (inputValue) => {
    const res = await axios.get('/api/companies/', {
        params: {search: inputValue}
    });
    return res.data.results.map(company => ({
        label: company.name,
        value: company.id,
        data: company
    }));
};

const AsyncCompanySelect = ({value, onChange, isMulti = false, placeholder = "Select Company"}) => {
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
            placeholder={placeholder}  // ✅ dynamic placeholder
            getOptionLabel={(e) => e.label}
        />
    );
};

export default AsyncCompanySelect;
