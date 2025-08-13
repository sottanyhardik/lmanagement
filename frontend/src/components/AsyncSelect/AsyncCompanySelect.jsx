// src/components/AsyncCompanySelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (v) =>
    v ? {value: v.id ?? v.value ?? v, label: v.name ?? v.label ?? String(v), data: (v.data ?? v)} : null;

export default function AsyncCompanySelect({
                                               value,
                                               onChange,
                                               isMulti = false,
                                               placeholder = 'Select Company',
                                               defaultOptions = false,
                                               ...props
                                           }) {
    return (
        <GenericAsyncSelect
            endpoint="companies/"
            toOption={toOption}
            defaultOptions={defaultOptions}
            isMulti={isMulti}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            {...props}
        />
    );
}
