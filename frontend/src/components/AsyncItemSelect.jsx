import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../api/axiosInstance.js';

const AsyncItemSelect = ({value = [], onChange, isMulti = true}) => {
    const loadOptions = async (inputValue) => {
        if (!inputValue || inputValue.length < 2) return [];
        const res = await axios.get(`/api/item-names/?search=${inputValue}`);
        return res.data.results.map((item) => ({
            label: item.name,
            value: item.id,
            ...item,
        }));
    };

    const formatValue = (v) => {
        const toOption = (item) =>
            item?.id && item?.name
                ? {label: item.name, value: item.id, ...item}
                : null;

        if (isMulti) {
            return Array.isArray(v) ? v.map(toOption).filter(Boolean) : [];
        } else {
            return toOption(v);
        }
    };

    return (
        <AsyncSelect
            classNamePrefix="react-select"
            className="underline-select"
            isMulti={isMulti}
            cacheOptions
            defaultOptions={false} // ✅ don't fetch unless user types
            loadOptions={loadOptions}
            value={formatValue(value)}
            onChange={(selected) => onChange(isMulti ? selected || [] : selected)}
            getOptionLabel={(e) => e.name || e.label}
            getOptionValue={(e) => e.id || e.value}
            isClearable
            placeholder="Select item(s)"
        />
    );
};

export default AsyncItemSelect;
