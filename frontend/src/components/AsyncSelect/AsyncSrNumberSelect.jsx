// src/components/AsyncSrNumberSelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (item) =>
    item ? ({value: item.id, label: item.display_name, data: item}) : null;

export default function AsyncSrNumberSelect({
                                                value,
                                                onChange,
                                                isMulti = false,
                                                placeholder = 'Select SR Number',
                                                defaultOptions = false,
                                                ...props
                                            }) {
    return (
        <GenericAsyncSelect
            endpoint="license-import-items/"
            toOption={toOption}
            searchParam="display_name"
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
