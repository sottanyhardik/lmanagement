// components/AsyncAllotmentSelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const loadOptions = async (inputValue) => {
    const response = await axios.get('/api/option-allotments/', {
        params: {search: inputValue}
    });
    return response.data.results.map(a => ({
        value: a.id,
        label: `${a.invoice} - ${a.item_name} - ${a.required_quantity} - ${a.company?.name}`,
        data: a
    }));
};

const AsyncAllotmentSelect = ({value, onChange, isMulti = true}) => {
    const handleChange = (selected) => {
        onChange(selected?.map(s => s.data));
    };

    const defaultValue = (value || []).map(v => ({
        value: v.id,
        label: `${v.invoice} - ${v.item_name} - ${v.required_quantity} - ${v.company?.name}`,
        data: v
    }));

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            isMulti={isMulti}
            onChange={handleChange}
            value={defaultValue}
            getOptionLabel={(e) => e.label}
        />
    );
};

export default AsyncAllotmentSelect;
