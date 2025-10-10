// src/components/AsyncItemSelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (item) => item ? ({value: item.id, label: item.name, data: item}) : null;

export default function AsyncItemSelect({
                                            value = [],
                                            onChange,
                                            isMulti = true,
                                            placeholder = 'Select item(s)',
                                            defaultOptions = false,
                                            ...props
                                        }) {
    return (
        <GenericAsyncSelect
            endpoint="item-names/"
            toOption={toOption}
            searchParam="search"
            minChars={2}
            defaultOptions={defaultOptions}
            isMulti={isMulti}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            {...props}
        />
    );
}
