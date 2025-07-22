import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const AsyncHeadNormSelect = ({value, onChange}) => {
    const loadOptions = async (inputValue) => {
        const res = await axios.get(`api/head-norms/?search=${inputValue}`);
        return res.data.results.map((head) => ({
            label: head.name,
            value: head.id,
            ...head,
        }));
    };

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            value={value ? {label: value.name, value: value.id, ...value} : null}
            getOptionLabel={(e) => e.label}
            getOptionValue={(e) => e.value}
            onChange={onChange}
            isClearable
            placeholder="Select Head Norm"
        />
    );
};

export default AsyncHeadNormSelect;
