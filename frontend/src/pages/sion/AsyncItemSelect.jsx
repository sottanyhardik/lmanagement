import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const AsyncItemSelect = ({value, onChange}) => {
    const loadOptions = (inputValue) =>
        axios
            .get(`/api/item-names/?search=${inputValue}`)
            .then((res) =>
                res.data.results.map((item) => ({
                    label: item.name,
                    value: item.id,
                    ...item,
                }))
            );

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions
            value={value ? {label: value.name, value: value.id, ...value} : null}
            getOptionLabel={(e) => e.name}
            getOptionValue={(e) => e.id}
            loadOptions={loadOptions}
            onChange={onChange}
            isClearable
            placeholder="Select item"
        />
    );
};

export default AsyncItemSelect;
