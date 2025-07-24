import React from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../../api/axiosInstance';

const AsyncHSCodeSelect = ({value = [], onChange}) => {
    const loadOptions = (inputValue) =>
        axios
            .get(`api/hs-codes/?search=${inputValue}`)
            .then((res) =>
                res.data.results.map((hs) => ({
                    label: `${hs.hs_code} – ${hs.product_description}`,
                    value: hs.id,
                    ...hs,
                }))
            );

    return (
        <AsyncSelect
            isMulti
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            value={
                value
                    ? value.map((v) => ({
                        label: `${v.hs_code} – ${v.product_description}`,
                        value: v.id,
                        ...v,
                    }))
                    : []
            }
            getOptionLabel={(e) => `${e.hs_code} – ${e.product_description}`}
            getOptionValue={(e) => e.id}
            onChange={(selected) => onChange(selected || [])}
            placeholder="Select HS codes"
        />
    );
};

export default AsyncHSCodeSelect;
