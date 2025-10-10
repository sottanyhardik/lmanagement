// src/pages/HSCodeList.jsx
import React from 'react';
import GenericList from '../layouts/GenericList';

const validateHSCode = (item) => {
    const errors = {};
    const code = (item.hs_code || '').trim();

    if (!code) {
        errors.hs_code = 'HS Code is required';
    } else if (!/^\d{4,10}$/.test(code)) {
        // optional: 4–10 digits; tweak as needed (6/8, etc.)
        errors.hs_code = 'HS Code should be 4–10 digits';
    }

    const unitPrice = Number(item.unit_price);
    if (Number.isFinite(unitPrice) && unitPrice < 0) {
        errors.unit_price = 'Unit price must be non-negative';
    }

    return errors;
};

const fields = [
    {name: 'hs_code', label: 'HS Code'},
    {name: 'product_description', label: 'Description'},
    // If you want to show these too, just uncomment:
    // { name: 'unit_price',           label: 'Unit Price' },
    // { name: 'basic_duty',           label: 'Basic Duty' },
    // { name: 'unit',                 label: 'Unit' },
    // { name: 'policy',               label: 'Policy' },
    // { name: 'note',                 label: 'Note' },
];

const initialItem = {
    hs_code: '',
    product_description: '',
    unit_price: 0,
    basic_duty: '',
    unit: '',
    policy: '',
    note: '',
};

export default function HSCodeList() {
    return (
        <GenericList
            resource="hs-codes"            // ✅ no /api prefix; GenericList should not prepend a leading slash
            title="📋 HS Code List"
            fields={fields}
            validateItem={validateHSCode}
            initialItem={initialItem}
        />
    );
}
