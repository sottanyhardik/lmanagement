import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../api/axiosInstance.js';

const AsyncNormSelect = ({value, onChange}) => {
    const loadOptions = async (inputValue) => {
        const res = await axios.get(`api/sion-classes/?search=${inputValue}`);
        return res.data.results.map((head) => ({
            label: head.norm_class,
            value: head.id,
            ...head,
        }));
    };

    return (
        <AsyncSelect
            classNamePrefix="react-select"
            className="underline-select"
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            value={value ? {label: value.norm_class, value: value.id, ...value} : null}
            getOptionLabel={(e) => e.label}
            getOptionValue={(e) => e.value}
            onChange={onChange}
            isClearable
            placeholder="Select Head Norm"
        />
    );
};

export default AsyncNormSelect;
