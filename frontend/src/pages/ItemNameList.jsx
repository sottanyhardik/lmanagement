import React, {useEffect, useState} from 'react';
import AsyncSelect from 'react-select/async';
import axios from '../api/axiosInstance';
import GenericList from '../layouts/GenericList';

const validateItemName = (item) => {
    const errors = {};
    if (!item.name?.trim()) errors.name = 'Name is required';
    if (item.unit_price < 0) errors.unit_price = 'Unit price must be positive';
    if (!item.head) errors.head = 'Item Head is required';
    return errors;
};

// Cache for head ID to name mapping
const ItemNameList = () => {
    const [headOptionsMap, setHeadOptionsMap] = useState({});

    useEffect(() => {
        axios.get('api/item-heads/?page_size=10').then(res => {
            const map = {};
            res.data.results.forEach(h => {
                map[h.id] = h.name;
            });
            setHeadOptionsMap(map);
        });
    }, []);

    // Fetch options for async select
    const loadHeadOptions = async (inputValue) => {
        const res = await axios.get('api/item-heads/', {params: {search: inputValue}});
        return res.data.results.map((item) => ({
            value: item.id,
            label: item.name,
        }));
    };

    const renderInput = {
        is_active: (val, onChange) => (
            <input
                type="checkbox"
                className="form-check-input"
                checked={val}
                onChange={(e) => onChange(e.target.checked)}
            />
        ),
        head: (val, onChange) => (
            <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={loadHeadOptions}
                value={
                    val
                        ? {value: val, label: headOptionsMap[val] || `#${val}`}
                        : null
                }
                onChange={(option) => onChange(option?.value)}
                placeholder="Select Head..."
            />
        ),
    };

    const renderField = {
        is_active: (val) => (val ? '✅' : '❌'),
        head: (_, item) => item.head_label || headOptionsMap[item.head] || `#${item.head}`,
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
        head: '',
    };

    return (
        <GenericList
            resource="api/item-names"
            title="Item Names"
            fields={fields}
            validateItem={validateItemName}
            initialItem={initialItem}
            renderInput={renderInput}
            renderField={renderField}
        />
    );
};

export default ItemNameList;
