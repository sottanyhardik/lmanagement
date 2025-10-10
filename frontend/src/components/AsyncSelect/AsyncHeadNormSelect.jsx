// src/components/AsyncHeadNormSelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (head) => head ? ({value: head.id, label: head.name, data: head}) : null;

export default function AsyncHeadNormSelect({
                                                value,
                                                onChange,
                                                placeholder = 'Select Head Norm',
                                                defaultOptions = true,
                                                ...props
                                            }) {
    return (
        <GenericAsyncSelect
            endpoint="head-norms/"
            toOption={toOption}
            defaultOptions={defaultOptions}
            isMulti={false}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            {...props}
        />
    );
}
