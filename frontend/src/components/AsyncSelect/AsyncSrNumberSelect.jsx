import React from "react";
import GenericAsyncSelect from "../common/GenericAsyncSelect";

// Map API item to react-select option
const toOption = (item) =>
    item
        ? {
            value: item.id,
            label:
                item.display_name ||
                `${item.license_number || "LIC"} • SR ${item.serial_number || ""}`,
            data: item, // keep full payload
            id: item.id,
        }
        : null;

export default function AsyncSrNumberSelect({
                                                value,
                                                onChange,
                                                placeholder = "Select License SR",
                                                isMulti = false,
                                            }) {
    return (
        <GenericAsyncSelect
            endpoint="license-import-items/"
            toOption={toOption}
            searchParam="search"
            minChars={1}
            dedupe
            defaultOptions={false}
            isMulti={isMulti}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
        />
    );
}
