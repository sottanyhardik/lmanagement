// src/components/AsyncNormSelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (norm) => norm ? ({value: norm.id, label: norm.norm_class, data: norm}) : null;

export default function AsyncNormSelect({
                                            value,
                                            onChange,
                                            placeholder = 'Select Head Norm',
                                            defaultOptions = true,
                                            ...props
                                        }) {
    return (
        <GenericAsyncSelect
            endpoint="sion-classes/"
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
