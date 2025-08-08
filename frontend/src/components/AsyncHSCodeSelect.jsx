import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../api/axiosInstance';

const AsyncHSCodeSelect = ({value, onChange, isMulti = false, placeholder = 'Select HS Code'}) => {
    const loadOptions = async (inputValue) => {
        if (!inputValue || inputValue.length < 2) return [];
        const res = await axios.get(`/api/hs-codes/?search=${inputValue}`);
        console.log(res.data.results);
        return res.data.results.map(hs => ({
            label: `${hs.hs_code}`,
            value: hs.id,
            ...hs
        }));
    };

    const formatValue = (val) => {
        if (!val) return null;
        const toOption = (v) =>
            typeof v === 'object'
                ? {value: v.id, label: `${v.hs_code}`, ...v}
                : null;

        return isMulti
            ? (val || []).map(toOption).filter(Boolean)
            : toOption(val);
    };

    return (
        <AsyncSelect
            classNamePrefix="react-select"
            className="underline-select"
            cacheOptions
            loadOptions={loadOptions}
            defaultOptions={false} // ✅ disables auto-fetch on mount
            value={formatValue(value)}
            onChange={onChange}
            isMulti={isMulti}
            isClearable
            placeholder={placeholder}
        />
    );
};

export default AsyncHSCodeSelect;