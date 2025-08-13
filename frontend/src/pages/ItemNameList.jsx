// src/pages/ItemNameList.jsx
import React, {useCallback, useEffect, useState} from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../api/axiosInstance';
import GenericList from '../layouts/GenericList';

const validateItemName = (item) => {
    const errors = {};
    const name = item.name?.trim();
    const unitPriceNum = Number(item.unit_price);
    if (!name) errors.name = 'Name is required';
    if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) {
        errors.unit_price = 'Unit price must be a non-negative number';
    }
    if (!item.head) errors.head = 'Item Head is required';
    return errors;
};

export default function ItemNameList() {
    // Cache id -> label for heads (for read-friendly display)
    const [headLabelById, setHeadLabelById] = useState({});

    // Prime some labels so existing rows render nicely
    useEffect(() => {
        (async () => {
            try {
                const {data} = await axios.get('item-heads/', {params: {page_size: 100}});
                const map = {};
                (data?.results || data || []).forEach((h) => (map[h.id] = h.name));
                setHeadLabelById((prev) => ({...prev, ...map}));
            } catch {
                /* no-op */
            }
        })();
    }, []);

    const loadHeadOptions = useCallback(async (inputValue) => {
        const {data} = await axios.get('item-heads/', {params: {search: inputValue}});
        const results = data?.results || [];
        const map = {};
        const options = results.map((h) => {
            map[h.id] = h.name;
            return {value: h.id, label: h.name};
        });
        // cache labels we just fetched
        setHeadLabelById((prev) => ({...prev, ...map}));
        return options;
    }, []);

    const renderInput = {
        is_active: (val, onChange) => (
            <input
                type="checkbox"
                className="form-check-input"
                checked={!!val}
                onChange={(e) => onChange(e.target.checked)}
            />
        ),
        unit_price: (val, onChange) => (
            <input
                type="number"
                className="form-control form-control-sm"
                value={val ?? ''}
                min={0}
                step="0.01"
                onChange={(e) => onChange(e.target.value)}
                placeholder="0.00"
            />
        ),
        head: (val, onChange) => (
            <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={loadHeadOptions}
                value={val ? {value: val, label: headLabelById[val] || `#${val}`} : null}
                onChange={(opt) => onChange(opt?.value ?? null)}
                classNamePrefix="react-select"
                className="underline-select"
                placeholder="Select Head…"
                isClearable
            />
        ),
    };

    const renderField = {
        is_active: (v) => (v ? '✅' : '❌'),
        head: (_val, row) => row.head_label || headLabelById[row.head] || (row.head ? `#${row.head}` : '—'),
    };

    const fields = [
        {name: 'name', label: 'Item Name'},
        {name: 'unit_price', label: 'Unit Price'},
        {name: 'is_active', label: 'Active?'},
        {name: 'head', label: 'Item Head'},
    ];

    const initialItem = {
        name: '',
        unit_price: 0,
        is_active: false,
        head: null,
    };

    return (
        <GenericList
            resource="item-names"
            title="📋 Item Names"
            fields={fields}
            validateItem={validateItemName}
            initialItem={initialItem}
            renderInput={renderInput}
            renderField={renderField}
        />
    );
}
