import React from 'react';
import GenericAsyncSelect from '../common/GenericAsyncSelect';

const toOption = (item) => item ? ({
    value: item.id,
    label: `${item.invoice} - ${item.item_name} - ${item.required_quantity} - ${item.company?.name || ''}`,
    data: item,
}) : null;

export default function AsyncSchemeCodeSelect({
                                                  value,
                                                  onChange,
                                                  isMulti = true,
                                                  placeholder = "Select Scheme Code",
                                                  currentBoeId = null,
                                              }) {
    return (
        <GenericAsyncSelect
            endpoint="choices/"
            toOption={toOption}
            searchParam="search"
            minChars={1}
            dedupe
            defaultOptions={false}
            isMulti={isMulti}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            extraParams={() => ({
                exclude_assigned: 'true',
                ...(currentBoeId ? {current_boe_id: currentBoeId} : {}),
            })}
        />
    );
}
