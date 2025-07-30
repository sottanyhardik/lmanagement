import React from 'react';
import AsyncSelect from 'react-select/async';
import {useDebouncedAsyncOptions} from '../../hooks/useDebouncedAsyncOptions';

const AsyncAllotmentSelect = ({
                                  value,
                                  onChange,
                                  isMulti = true,
                                  placeholder = "Select Allotment",
                                  currentBoeId = null
                              }) => {
    const formatLabel = (item) =>
        `${item.invoice} - ${item.item_name} - ${item.required_quantity} - ${item.company?.name || ''}`;

    const baseLoader = useDebouncedAsyncOptions(
        '/api/option-allotments/',
        'search',
        'id',
        {
            exclude_assigned: 'true',
            ...(currentBoeId ? {current_boe_id: currentBoeId} : {})
        }
    );

    const loadOptions = async (inputValue) => {
        const options = await baseLoader(inputValue);
        if (!Array.isArray(options)) return [];

        const seen = new Set();
        const filteredOptions = options
            .map(o => ({
                ...o,
                label: formatLabel(o.data),
            }))
            .filter(opt => {
                if (seen.has(opt.value)) return false;
                seen.add(opt.value);
                return true;
            });

        return filteredOptions;
    };

    const toOption = (v) => {
        if (!v) return null;
        if (v.value && v.label) {
            return v;
        }
        if (v.id) {
            return {
                value: v.id,
                label: formatLabel(v),
                data: v,
            };
        }
        return null;
    };

    const formattedValue = isMulti
        ? (value || []).map(toOption).filter(Boolean)
        : value ? toOption(value) : null;

    const handleChange = (selected) => {
        if (isMulti) {
            onChange((selected || []).map(s => s.data));
        } else {
            onChange(selected?.data || null);
        }
    };

    return (
        <AsyncSelect
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            isMulti={isMulti}
            value={formattedValue}
            onChange={handleChange}
            isClearable
            placeholder={placeholder}
            styles={{
                control: base => ({...base, minHeight: '32px', fontSize: '0.875rem'}),
                menu: base => ({...base, zIndex: 9999}),
            }}
        />
    );
};

export default AsyncAllotmentSelect;
