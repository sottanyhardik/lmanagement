// AsyncPortSelect.jsx
import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const AsyncPortSelect = ({value, onChange}) => {
    const loadOptions = async (inputValue) => {
        const res = await axios.get(`/api/ports/?search=${inputValue}`);
        return res.data.results.map(port => ({
            label: port.name,
            value: port.id,
            ...port
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
            placeholder="Select Port"
        />
    );
};

export default AsyncPortSelect;
