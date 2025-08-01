import React from 'react';
import AsyncSelect from 'react-select/async';
import {useDebouncedAsyncOptions} from '../../hooks/useDebouncedAsyncOptions';

const AsyncEntitySelect = ({
                               value,
                               onChange,
                               isMulti = false,
                               placeholder = "Select Entity"
                           }) => {
    const formatLabel = (entity) =>
        `${entity.name} — ${entity.pan_number || 'No PAN'} — ${entity.gst_number || 'No GST'}`;

    const baseLoader = useDebouncedAsyncOptions(
        '/api/invoice-entities/',
        'search',
        'id'
    );

    const loadOptions = async (inputValue) => {
        const options = await baseLoader(inputValue);
        if (!Array.isArray(options)) return [];

        const seen = new Set();
        return options
            .map(e => ({
                value: e.id,
                label: formatLabel(e.data),
                data: e.data
            }))
            .filter(opt => {
                if (seen.has(opt.value)) return false;
                seen.add(opt.value);
                return true;
            });
    };

    const toOption = (v) => {
        if (!v) return null;
        if (v.value && v.label) return v;
        if (v.id) {
            return {
                value: v.id,
                label: formatLabel(v),
                data: v
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
            defaultOptions={false}
            loadOptions={loadOptions}
            isMulti={isMulti}
            value={formattedValue}
            onChange={handleChange}
            isClearable
            placeholder={placeholder}
            styles={{
                control: base => ({...base, minHeight: '32px', fontSize: '0.875rem'}),
                menu: base => ({...base, zIndex: 9999})
            }}
        />
    );
};

export default AsyncEntitySelect;
