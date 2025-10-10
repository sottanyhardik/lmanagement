// src/components/AsyncHSCodeSelect.jsx
import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (hs) => hs ? ({value: hs.id, label: `${hs.hs_code}`, data: hs}) : null;

export default function AsyncHSCodeSelect({
                                              value,
                                              onChange,
                                              isMulti = false,
                                              placeholder = 'Select HS Code',
                                              defaultOptions = false,
                                              ...props
                                          }) {
    return (
        <GenericAsyncSelect
            endpoint="hs-codes/"
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
