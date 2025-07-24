// AsyncCompanySelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const AsyncCompanySelect = ({value, onChange}) => {
    const loadOptions = async (inputValue) => {
        const res = await axios.get(`/api/companies/?search=${inputValue}`);
        return res.data.results.map(company => ({
            label: company.name,
            value: company.id,
            ...company
        }));
    };

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            value={value ? {label: value.name, value: value.id, ...value} : null}
            onChange={onChange}
            isClearable
            placeholder="Select Company"
        />
    );
};

export default AsyncCompanySelect;