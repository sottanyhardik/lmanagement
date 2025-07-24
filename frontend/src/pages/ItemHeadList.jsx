import React from 'react';
import GenericList from '../layouts/GenericList';

const validateItemHead = (item) => {
    const errors = {};
    if (!item.name?.trim()) errors.name = 'Name is required';
    if (item.unit_rate < 0) errors.unit_rate = 'Unit rate cannot be negative';
    return errors;
};

const fields = [
    {name: 'name', label: 'Name'},
    {name: 'is_restricted', label: 'Restricted?'},
    {name: 'dict_key', label: 'Dict Key'},
];

const renderInput = {
    is_restricted: (val, onChange) => (
        <input
            type="checkbox"
            className="form-check-input"
            checked={val}
            onChange={(e) => onChange(e.target.checked)}
        />
    ),
};

const renderField = {
    is_restricted: (val) => (val ? '✅' : '❌'),
};

const initialItem = {
    name: '',
    unit_rate: 0,
    is_restricted: false,
    dict_key: '',
};

const ItemHeadList = () => (
    <GenericList
        resource="api/item-heads"
        title="📋 Item Heads"
        fields={fields}
        validateItem={validateItemHead}
        initialItem={initialItem}
        renderInput={renderInput}
        renderField={renderField}
    />
);

export default ItemHeadList;
