// src/components/AsyncPortSelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (v) =>
    v?.id
        ? {value: v.id, label: v.name, data: v}
        : v?.value && v.label
            ? {value: v.value, label: v.label, data: v.data || {id: v.value, name: v.label}}
            : null;

export default function AsyncPortSelect({
                                            value,
                                            onChange,
                                            isMulti = false,
                                            placeholder = 'Select Port',
                                            defaultOptions = false,
                                            ...props
                                        }) {
    return (
        <GenericAsyncSelect
            endpoint="ports/"
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
