// src/components/AsyncSelect/AsyncBOESelect.jsx
import React from "react";
import GenericAsyncSelect from "../common/GenericAsyncSelect";

const toOption = (item) =>
    item
        ? {
            value: item.id,
            label: `${item.bill_of_entry_number} (${item.bill_of_entry_date}) - ${item.company?.name || ""}`,
            data: item,
        }
        : null;

/**
 * AsyncBOESelect
 *
 * Dropdown for Bill of Entry options.
 * Props:
 *  - value: selected option(s)
 *  - onChange: handler
 *  - isMulti: allow multiple selections
 *  - placeholder: input placeholder
 *  - extraParams: function or object -> additional query params
 */
export default function AsyncBOESelect({
                                           value,
                                           onChange,
                                           isMulti = false,
                                           placeholder = "Select Bill of Entry",
                                           extraParams = () => ({}),
                                       }) {
    return (
        <GenericAsyncSelect
            endpoint="option-boes/"
            toOption={toOption}
            searchParam="search"
            minChars={1}
            dedupe
            defaultOptions={false}
            isMulti={isMulti}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            extraParams={extraParams}
        />
    );
}
