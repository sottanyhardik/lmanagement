import React from 'react';
import AsyncSelect from 'react-select/async';
import {useDebouncedAsyncOptions} from '../../hooks/useDebouncedAsyncOptions';

const AsyncCompanySelect = ({
                                value,
                                onChange,
                                isMulti = false,
                                placeholder = "Select Company"
                            }) => {
    const loadOptions = useDebouncedAsyncOptions('/api/companies/');

    const toOption = (v) => v ? {label: v.name, value: v.id, data: v} : null;

    const formattedValue = isMulti
        ? (value || []).map(toOption)
        : toOption(value);

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
            loadOptions={loadOptions}
            isMulti={isMulti}
            value={formattedValue}
            onChange={handleChange}
            placeholder={placeholder}
            defaultOptions={false} // disables initial fetch
        />
    );
};

export default AsyncCompanySelect;