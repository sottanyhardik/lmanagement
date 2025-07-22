import React from 'react';
import GenericList from '../layouts/GenericList';

const validateHSCode = (item) => {
    const errors = {};
    if (!item.hs_code?.trim()) errors.hs_code = 'HS Code is required';
    return errors;
};

const fields = [
    {name: 'hs_code', label: 'HS Code'},
    {name: 'product_description', label: 'Description'},
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

const HSCodeList = () => (
    <GenericList
        resource="api/hs-codes"
        title="HS Code List"
        fields={fields}
        validateItem={validateHSCode}
        initialItem={initialItem}
    />
);

export default HSCodeList;
